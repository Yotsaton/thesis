//src/components/Map.ts
import { appState } from '../state/index.js';
import { CONFIG } from '../services/config.js';
import { renderPlaceDetailsPanel, type PlaceDetails } from './PlaceDetailsPanel.js';
import { debounce } from '../helpers/utils.js';
import type { Day, PlaceItem } from '../types.js'; // ⬅️ แก้ไข: import Type จากที่ใหม่

// --- Type Definitions for Google Maps Objects ---
type GoogleMap = google.maps.Map;
type GoogleMarker = google.maps.Marker;
type DirectionsRenderer = google.maps.DirectionsRenderer;
type Geocoder = google.maps.Geocoder;
type DirectionsService = google.maps.DirectionsService;
type LatLngBounds = google.maps.LatLngBounds;
type DirectionsResult = google.maps.DirectionsResult;
type DirectionsStatus = google.maps.DirectionsStatus;

// --- Module State Variables ---
let map: GoogleMap;
let markers: GoogleMarker[] = [];
let dailyDirectionRenderers: DirectionsRenderer[] = [];
let geocoder: Geocoder;
let directionsService: DirectionsService;
let mapsApiReady = false;
let temporaryMarker: GoogleMarker | null = null;

let mapReadyPromiseResolver: (value: boolean) => void;
const mapReadyPromise = new Promise<boolean>(resolve => {
  mapReadyPromiseResolver = resolve;
});

// --- Functions ---
export function clearTemporaryMarker(): void {
  if (temporaryMarker) {
    temporaryMarker.setMap(null);
    temporaryMarker = null;
  }
}

function panToAndHighlightPlace(placeLike: PlaceDetails): void {
    clearTemporaryMarker();
    const location = placeLike.geometry?.location || placeLike.location;
    if (!location) return;
    const latLng = typeof location.lat === 'function' ? new google.maps.LatLng(location.lat(), location.lng()) : new google.maps.LatLng(location.lat, location.lng);
    map.panTo(latLng);
    map.setZoom(15);
    temporaryMarker = new google.maps.Marker({
        position: latLng, map, animation: google.maps.Animation.DROP,
        icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#d9534f', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 9 }
    });
}

function createColoredMarkerIcon(color: string){ return { path: google.maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 11 }; }

export async function fetchAndDisplayPlaceDetails(placeId: string, dayIndex: number | null = null): Promise<void> {
    if (!mapsApiReady) await mapReadyPromise;
    try {
        const svc = new google.maps.places.PlacesService(map);
        const req = { placeId, fields: ['place_id','name','formatted_address','geometry','rating','user_ratings_total','opening_hours','url','photos', 'editorial_summary', 'formatted_phone_number'] };
        svc.getDetails(req, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                panToAndHighlightPlace(place as unknown as PlaceDetails);
                renderPlaceDetailsPanel(place as unknown as PlaceDetails, dayIndex);
            } else {
                console.error('Place details failed:', status);
            }
        });
    } catch(e) { console.error('Place details load failed:', e); }
}

function onMapsApiLoaded(): void {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    console.error('Map container element not found!');
    return;
  }
  const center = { lat: 13.7563, lng: 100.5018 };
  map = new google.maps.Map(mapElement, { center, zoom: 12, clickableIcons: true, gestureHandling: 'greedy', mapTypeControl: false });
  geocoder = new google.maps.Geocoder();
  directionsService = new google.maps.DirectionsService();

  map.addListener('click', (e: google.maps.MapMouseEvent | google.maps.IconMouseEvent) => {
    clearTemporaryMarker();
    if ('placeId' in e && e.placeId) {
      (e as google.maps.IconMouseEvent).stop();
      fetchAndDisplayPlaceDetails(e.placeId);
      return;
    }
    if (e.latLng) {
        geocoder.geocode({ location: e.latLng }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                 const placeData: PlaceDetails = {
                    name: results[0].formatted_address,
                    formatted_address: results[0].formatted_address,
                    geometry: { location: e.latLng! }
                };
                panToAndHighlightPlace(placeData);
                renderPlaceDetailsPanel(placeData);
            }
        });
    }
  });

  mapsApiReady = true;
  mapReadyPromiseResolver(true);
}

export function initMap(): Promise<boolean> {
  window.onMapsApiLoaded = onMapsApiLoaded;
  const key = encodeURIComponent(CONFIG.GOOGLE_MAPS_API_KEY);
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,directions&v=weekly&language=th&region=TH&callback=onMapsApiLoaded`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    console.error("Google Maps script failed to load.");
    mapReadyPromiseResolver(false);
  };
  document.head.appendChild(script);
  return mapReadyPromise;
}

const debouncedRouteCalculation = debounce((routesToCalc: any[]) => {
  dailyDirectionRenderers.forEach(r => r.setMap(null));
  dailyDirectionRenderers = [];
  routesToCalc.forEach((routeInfo) => {
    const req = { origin: routeInfo.origin, destination: routeInfo.destination, waypoints: routeInfo.waypoints, travelMode: google.maps.TravelMode.DRIVING };
    directionsService.route(req, (result: DirectionsResult | null, status: DirectionsStatus) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        const renderer = new google.maps.DirectionsRenderer({
          map, directions: result, suppressMarkers: true,
          polylineOptions: { strokeColor: routeInfo.color, strokeWeight: 5, strokeOpacity: 0.8 }
        });
        dailyDirectionRenderers.push(renderer);
      } else {
        console.warn(`Directions failed: ${status}`);
      }
    });
  });
}, 500);

export function renderMapMarkersAndRoute(): void {
    if (!mapsApiReady || !map) return;
    const days: Day[] = appState.currentTrip.days;
    const focusedDayIndex = appState.activeDayIndex;

    markers.forEach(m => m.setMap(null));
    markers = [];
    if (!days || days.length === 0) {
      debouncedRouteCalculation([]);
      return;
    }

    const bounds: LatLngBounds = new google.maps.LatLngBounds();
    let overallIndex = 1;
    
    days.forEach((day: Day, dayIndex: number) => {
        const placesOnly = (day.items || []).filter((item): item is PlaceItem => 
            item.type === 'place' && 
            !!item.location && 
            Array.isArray(item.location.coordinates) && 
            item.location.coordinates.length === 2
        );
        
        const isVisible = focusedDayIndex === null || focusedDayIndex === dayIndex;
        if (isVisible && placesOnly.length > 0) {
            placesOnly.forEach((p: PlaceItem) => {
                if (p.location) {
                    const position = { lat: p.location.coordinates[1], lng: p.location.coordinates[0] };
                    const marker = new google.maps.Marker({
                        position, map, 
                        icon: createColoredMarkerIcon(day.color),
                        label: { text: String(overallIndex), color: 'white', fontWeight: 'bold' }, title: p.name
                    });
                    markers.push(marker);
                    bounds.extend(position);
                    overallIndex++;
                }
            });
        }
    });
    
    const routesToCalc: any[] = [];
    const daysToRoute = focusedDayIndex !== null && days[focusedDayIndex] ? [days[focusedDayIndex]] : days;
    daysToRoute.forEach((day: Day) => {
        const placesOnly = (day.items || []).filter((i): i is PlaceItem => i.type === 'place' && !!i.location && Array.isArray(i.location.coordinates) && i.location.coordinates.length === 2);
        if (placesOnly.length >= 2) {
            const originCoords = placesOnly[0].location!.coordinates;
            const destCoords = placesOnly[placesOnly.length - 1].location!.coordinates;
            routesToCalc.push({
                origin: { lat: originCoords[1], lng: originCoords[0] },
                destination: { lat: destCoords[1], lng: destCoords[0] },
                waypoints: placesOnly.slice(1, -1).map(p => ({ location: { lat: p.location!.coordinates[1], lng: p.location!.coordinates[0] }, stopover: true })),
                color: day.color
            });
        }
    });

    debouncedRouteCalculation(routesToCalc);

    if (markers.length > 0) {
        map.fitBounds(bounds);
        google.maps.event.addListenerOnce(map, 'idle', () => {
            if (map.getZoom()! > 17) {
                map.setZoom(17);
            }
        });
    }
}

export function attachAutocompleteWhenReady(inputEl: HTMLInputElement, onPlaceSelected: (placeData: any) => void): void {
    if (!mapsApiReady) {
        mapReadyPromise.then(() => attachAutocompleteWhenReady(inputEl, onPlaceSelected));
        return;
    }
    const autocomplete = new google.maps.places.Autocomplete(inputEl, {
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'th' }
    });
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;
        onPlaceSelected({
            name: place.name || place.formatted_address,
            place_id: place.place_id,
            location: place.geometry.location.toJSON(),
            raw: place
        });
    });
}

export async function getDirectionsBetweenTwoPoints(origin: {lat: number, lng: number}, destination: {lat: number, lng: number}): Promise<google.maps.DirectionsRoute | null> {
    if (!mapsApiReady) await mapReadyPromise;
    if (!directionsService) return null;
    
    const request = { origin, destination, travelMode: google.maps.TravelMode.DRIVING };
    try {
        const result = await directionsService.route(request);
        if (result && result.routes.length > 0) return result.routes[0];
        return null;
    } catch (e) { 
        console.error('Single directions request failed', e);
        return null; 
    }
}
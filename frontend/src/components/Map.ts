import { appState } from '../state/index.js';
import { CONFIG } from '../services/config.js';
import { renderPlaceDetailsPanel, type PlaceDetails } from './PlaceDetailsPanel.js';
import { getDirections } from '../services/routeService.js';
import type { Day, PlaceItem, GeoJSONPoint } from '../types.js';

// --- Type Definitions for Google Maps Objects ---
type GoogleMap = google.maps.Map;
type GoogleMarker = google.maps.Marker;
type LatLngBounds = google.maps.LatLngBounds;

// --- Module State Variables ---
let map: GoogleMap;
let markers: GoogleMarker[] = [];
let dailyRoutePolylines: google.maps.Polyline[] = [];
let geocoder: google.maps.Geocoder;
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
  const latLng =
    typeof location.lat === 'function'
      ? new google.maps.LatLng(location.lat(), location.lng())
      : new google.maps.LatLng(location.lat, location.lng);
  map.panTo(latLng);
  map.setZoom(15);
  temporaryMarker = new google.maps.Marker({
    position: latLng,
    map,
    animation: google.maps.Animation.DROP,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#d9534f',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
      scale: 9,
    },
  });
}

function createColoredMarkerIcon(color: string) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 2,
    scale: 11,
  };
}

export async function fetchAndDisplayPlaceDetails(
  placeId: string,
  dayIndex: number | null = null
): Promise<void> {
  if (!mapsApiReady) await mapReadyPromise;
  try {
    const svc = new google.maps.places.PlacesService(map);
    const req = {
      placeId,
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'geometry',
        'rating',
        'user_ratings_total',
        'opening_hours',
        'url',
        'photos',
        'editorial_summary',
        'formatted_phone_number',
      ],
    };
    svc.getDetails(req, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        panToAndHighlightPlace(place as unknown as PlaceDetails);
        renderPlaceDetailsPanel(place as unknown as PlaceDetails, dayIndex);
      } else {
        console.error('Place details failed:', status);
      }
    });
  } catch (e) {
    console.error('Place details load failed:', e);
  }
}

function onMapsApiLoaded(): void {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    console.error('Map container element not found!');
    return;
  }
  const center = { lat: 13.7563, lng: 100.5018 };
  map = new google.maps.Map(mapElement, {
    center,
    zoom: 12,
    clickableIcons: true,
    gestureHandling: 'greedy',
    mapTypeControl: false,
  });
  geocoder = new google.maps.Geocoder();

  map.addListener(
    'click',
    (e: google.maps.MapMouseEvent | google.maps.IconMouseEvent) => {
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
              geometry: { location: e.latLng! },
            };
            panToAndHighlightPlace(placeData);
            renderPlaceDetailsPanel(placeData);
          }
        });
      }
    }
  );

  mapsApiReady = true;
  mapReadyPromiseResolver(true);
}

export function initMap(): Promise<boolean> {
  window.onMapsApiLoaded = onMapsApiLoaded;
  const key = encodeURIComponent(CONFIG.GOOGLE_MAPS_API_KEY);
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly&language=th&region=TH&callback=onMapsApiLoaded`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    console.error('Google Maps script failed to load.');
    mapReadyPromiseResolver(false);
  };
  document.head.appendChild(script);
  return mapReadyPromise;
}

// 🔽 1. ฟังก์ชันนี้จะไม่ล้าง Polyline เก่า แต่จะเพิ่มเส้นใหม่เข้าไป 🔽
export function drawRoutePolyline(
  day: Day,
  routeGeometry: { coordinates: [number, number][] }
): void {
  if (!map) return;

  const path = routeGeometry.coordinates.map(
    (coords: [number, number]) => ({
      lng: coords[0],
      lat: coords[1],
    })
  );

  const routePolyline = new google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: day.color || '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 5,
  });
  routePolyline.setMap(map);
  dailyRoutePolylines.push(routePolyline);
}

// 🔽 2. renderMapMarkersAndRoute พร้อมเพิ่ม "เส้นข้ามวัน" 🔽
export async function renderMapMarkersAndRoute(): Promise<void> {
  if (!mapsApiReady || !map) return;

  const days: Day[] = appState.currentTrip.days;
  const focusedDayIndex = appState.activeDayIndex;

  markers.forEach(m => m.setMap(null));
  markers = [];
  dailyRoutePolylines.forEach(p => p.setMap(null));
  dailyRoutePolylines = [];

  if (!days || days.length === 0) return;

  const bounds: LatLngBounds = new google.maps.LatLngBounds();
  let overallIndex = 1;

  // --- วาดหมุดของแต่ละวัน ---
  days.forEach((day: Day, dayIndex: number) => {
    const placesOnly = (day.items || []).filter(
      (item): item is PlaceItem =>
        item.type === 'place' &&
        !!item.location &&
        Array.isArray(item.location.coordinates) &&
        item.location.coordinates.length === 2
    );

    const isVisible = focusedDayIndex === null || focusedDayIndex === dayIndex;
    if (isVisible && placesOnly.length > 0) {
      placesOnly.forEach((p: PlaceItem) => {
        if (p.location) {
          const position = {
            lat: p.location.coordinates[1],
            lng: p.location.coordinates[0],
          };
          const marker = new google.maps.Marker({
            position,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: day.color,
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
              scale: 11,
            },
            label: {
              text: String(overallIndex),
              color: 'white',
              fontWeight: 'bold',
            },
            title: p.name ?? '',
          });
          markers.push(marker);
          bounds.extend(position);
          overallIndex++;
        }
      });
    }
  });

  // --- เส้นทางในแต่ละวัน ---
  const daysToRoute =
    focusedDayIndex !== null && days[focusedDayIndex]
      ? [days[focusedDayIndex]]
      : days;

  for (const day of daysToRoute) {
    const placesWithLoc = (day.items || []).filter(
      (i): i is PlaceItem =>
        i.type === 'place' && !!i.location?.coordinates
    );
    if (placesWithLoc.length >= 2) {
      const origin = placesWithLoc[0].location!;
      const destination = placesWithLoc[placesWithLoc.length - 1].location!;
      const waypoint = placesWithLoc.slice(1, -1).map(p => p.location!) || [];

      const result = await getDirections(origin, destination, waypoint);
      if (result.success && result.route?.geometry?.coordinates) {
        drawRoutePolyline(day, result.route.geometry);
      }
      if (result.success && result.route) {
        localStorage.setItem(
          `day-${day.id}-route-segments`,
          JSON.stringify(result.route.segments)
        );
      }
    }
  }

  // --- ✅ เส้นทางข้ามวันแบบ "จริง" (คำนวณเส้นทางจริง) ---
  for (let i = 0; i < days.length - 1; i++) {
    // ถ้ามี focusedDayIndex → ให้ข้ามทุกคู่วัน ที่ไม่เกี่ยวข้องกับวันนั้น
    if (focusedDayIndex !== null && i !== focusedDayIndex) continue;

    const currentDay = days[i];
    const nextDay = days[i + 1];

    const currentPlaces = (currentDay.items || []).filter(
      (p): p is PlaceItem =>
        p.type === 'place' && !!p.location?.coordinates
    );
    const nextPlaces = (nextDay.items || []).filter(
      (p): p is PlaceItem =>
        p.type === 'place' && !!p.location?.coordinates
    );

    if (currentPlaces.length > 0 && nextPlaces.length > 0) {
      const lastPlace = currentPlaces[currentPlaces.length - 1];
      const firstNext = nextPlaces[0];

      // ✅ เพิ่มหมุดสีเทาเฉพาะวันถัดไปของวันที่โฟกัสเท่านั้น
      const nextPos = {
        lat: firstNext.location!.coordinates[1],
        lng: firstNext.location!.coordinates[0],
      };
      const nextMarker = new google.maps.Marker({
        position: nextPos,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#cccccc',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 1,
          scale: 9,
        },
        title: `[Start of Next Day] ${firstNext.name ?? ''}`,
      });
      markers.push(nextMarker);

      // ✅ ขอเส้นทางจริงจาก backend
      const origin = lastPlace.location!;
      const destination = firstNext.location!;
      const result = await getDirections(origin, destination, []);

      if (result.success && result.route?.geometry?.coordinates) {
        const path = result.route.geometry.coordinates.map(
          (coords: [number, number]) => ({
            lng: coords[0],
            lat: coords[1],
          })
        );
        const crossDayLine = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#444444ff',
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map,
        });
        dailyRoutePolylines.push(crossDayLine);
      }
    }
  }

  if (markers.length > 0) {
    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, 'idle', () => {
      const zoom = map.getZoom();
      if (zoom && zoom > 17) map.setZoom(17);
    });
  }
}


export function attachAutocompleteWhenReady(
  inputEl: HTMLInputElement,
  onPlaceSelected: (placeData: any) => void
): void {
  if (!mapsApiReady) {
    mapReadyPromise.then(() =>
      attachAutocompleteWhenReady(inputEl, onPlaceSelected)
    );
    return;
  }
  const autocomplete = new google.maps.places.Autocomplete(inputEl, {
    types: ['establishment', 'geocode'],
    componentRestrictions: { country: 'th' },
  });
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (!place.geometry?.location) return;
    onPlaceSelected({
      name: place.name || place.formatted_address,
      place_id: place.place_id,
      location: place.geometry.location.toJSON(),
      raw: place,
    });
  });
}

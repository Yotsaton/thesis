import { appState } from '../state/index.js';
import { CONFIG } from '../services/config.js';
import { renderPlaceDetailsPanel, type PlaceDetails } from './PlaceDetailsPanel.js';
import { getDirections } from '../services/routeService.js';
import { TRIP_COLORS } from '../helpers/utils.js';
import { getPlaceNumbering } from '../helpers/placeNumbering.js'; // 🆕 เพิ่ม
import type { Day, PlaceItem } from '../types.js';

// --- Google Maps Types ---
type GoogleMap = google.maps.Map;
type GoogleMarker = google.maps.Marker;
type LatLngBounds = google.maps.LatLngBounds;

// --- State ---
let map: GoogleMap;
let markers: GoogleMarker[] = [];
let dailyRoutePolylines: google.maps.Polyline[] = [];
let crossDayLines: google.maps.Polyline[] = [];
let geocoder: google.maps.Geocoder;
let mapsApiReady = false;
let temporaryMarker: GoogleMarker | null = null;

let mapReadyPromiseResolver: (value: boolean) => void;
const mapReadyPromise = new Promise<boolean>(resolve => {
  mapReadyPromiseResolver = resolve;
});

// --- Helpers ---
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

// --- Place Detail ---
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

// --- Init Map ---
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
            geometry: { location: e.latLng! },
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

// --- Day Route Polyline ---
export function drawRoutePolyline(day: Day, routeGeometry: { coordinates: [number, number][] }): void {
  if (!map) return;
  const path = routeGeometry.coordinates.map(coords => ({ lng: coords[0], lat: coords[1] }));
  const routePolyline = new google.maps.Polyline({
    path,
    geodesic: true,
    strokeColor: day.color || '#FF0000',
    strokeOpacity: 0.85,
    strokeWeight: 5,
  });
  routePolyline.setMap(map);
  dailyRoutePolylines.push(routePolyline);
}

// --- Main Render (with Smart Cache) ---
export async function renderMapMarkersAndRoute(): Promise<void> {
  if (!mapsApiReady || !map) return;

  const days: Day[] = appState.currentTrip.days;
  const focusedDayIndex = appState.activeDayIndex;

  days.forEach((day, i) => {
    if (!day.color) day.color = TRIP_COLORS[i % TRIP_COLORS.length];
  });

  // --- clear layers ---
  for (const arr of [markers, dailyRoutePolylines, crossDayLines]) {
    arr.forEach((el: any) => el.setMap && el.setMap(null));
  }
  markers = [];
  dailyRoutePolylines = [];
  crossDayLines = [];

  if (!days || days.length === 0) return;

  const bounds: LatLngBounds = new google.maps.LatLngBounds();

  // 🆕 ใช้ระบบหมายเลขใหม่
  const numberingMap = getPlaceNumbering();

  // --- Draw markers ---
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const placesOnly = (day.items || []).filter(
      (item): item is PlaceItem =>
        item.type === 'place' &&
        !!item.location &&
        Array.isArray(item.location.coordinates) &&
        item.location.coordinates.length === 2
    );

    const isVisible =
      typeof focusedDayIndex !== 'number' || focusedDayIndex === dayIndex;
    if (!isVisible || placesOnly.length === 0) continue;

    for (let placeIndex = 0; placeIndex < placesOnly.length; placeIndex++) {
      const p = placesOnly[placeIndex];
      const [lng, lat] = p.location!.coordinates;
      const position = { lat, lng };

      const info = numberingMap[`${dayIndex}-${placeIndex}`];
      const labelText = info?.number ? String(info.number) : '';
      const markerColor = info?.color || day.color;

      const marker = new google.maps.Marker({
        position,
        map,
        icon: createColoredMarkerIcon(markerColor),
        label: {
          text: labelText,
          color: 'white',
          fontWeight: 'bold',
        },
        title: p.name ?? '',
      });
      markers.push(marker);
      bounds.extend(position);
    }
  }

  // --- Route rendering (unchanged) ---
  const daysToRoute =
    focusedDayIndex !== null && days[focusedDayIndex]
      ? [days[focusedDayIndex]]
      : days;

  for (const day of daysToRoute) {
    const cacheKey = `day-${day.id}-route-geometry`;
    const hashKey = `day-${day.id}-route-hash`;

    const places = (day.items || []).filter(
      (i): i is PlaceItem => i.type === 'place' && !!i.location?.coordinates
    );

    if (places.length < 2) {
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(hashKey);
      localStorage.removeItem(`day-${day.id}-route-segments`);
      localStorage.removeItem(`day-${day.id}-summary`);
      continue;
    }

    // (ส่วนนี้ไม่แตะต้องเลย)
    const newHash = places
      .map(p => `${p.id || p.name}:${p.location!.coordinates.join(',')}`)
      .join('|');

    const oldHash = localStorage.getItem(hashKey);
    const cached = localStorage.getItem(cacheKey);

    if (cached && oldHash === newHash) {
      try {
        const { geometry, savedAt } = JSON.parse(cached);
        const isExpired = Date.now() - savedAt > 1000 * 60 * 60 * 6;
        if (!isExpired && geometry?.coordinates) {
          console.log(`[MAP] ✅ Using cached route for ${day.id}`);
          drawRoutePolyline(day, geometry);
          window.dispatchEvent(new CustomEvent('route-cache-updated', { detail: { dayId: day.id } }));
          continue;
        }
      } catch (err) {
        console.warn(`[MAP] Cache parse failed for ${day.id}`, err);
      }
    }

    const originGeo = { type: 'Point' as const, coordinates: places[0].location!.coordinates };
    const destGeo = { type: 'Point' as const, coordinates: places[places.length - 1].location!.coordinates };
    const waypoints = places.slice(1, -1).map(p => ({ type: 'Point' as const, coordinates: p.location!.coordinates }));

    console.log(`[MAP] 🛰 Fetching new route for day ${day.id}...`);
    const result = await getDirections(originGeo, destGeo, waypoints, { force: true });

    if (result.success && result.route?.geometry?.coordinates) {
      drawRoutePolyline(day, result.route.geometry);
      localStorage.setItem(cacheKey, JSON.stringify({ geometry: result.route.geometry, savedAt: Date.now() }));
      localStorage.setItem(hashKey, newHash);
      if (Array.isArray(result.route.segments)) {
        const segments = result.route.segments.map((seg: any) => ({
          distance: seg?.distance ?? 0,
          duration: seg?.duration ?? 0,
        }));
        localStorage.setItem(`day-${day.id}-route-segments`, JSON.stringify(segments));
      } else {
        localStorage.removeItem(`day-${day.id}-route-segments`);
      }
      const summary = {
        distance: (result.route.distance as number) ?? 0,
        duration: (result.route.duration as number) ?? 0,
      };
      day.summary = summary;
      localStorage.setItem(`day-${day.id}-summary`, JSON.stringify(summary));
      window.dispatchEvent(new CustomEvent('route-cache-updated', { detail: { dayId: day.id } }));
      console.log(`[MAP] 💾 Cached new route for day ${day.id}`);
    } else {
      console.warn(`[MAP] ⚠️ Route fetch failed for ${day.id}`, result.message);
      localStorage.removeItem(`day-${day.id}-route-segments`);
      localStorage.removeItem(`day-${day.id}-summary`);
    }
  }

  if (markers.length > 0) {
    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, 'idle', () => {
      const zoom = map.getZoom();
      if (zoom && zoom > 17) map.setZoom(17);
    });
  }

  // --- Cross-day route (เฉพาะเส้นที่เกี่ยวกับวันโฟกัส) ---
  for (let i = 0; i < days.length - 1; i++) {
    const cur = days[i];
    const next = days[i + 1];

    // ✅ แสดงเฉพาะเส้นเทาระหว่าง "วันปัจจุบันกับวันถัดไป" เท่านั้น
    if (focusedDayIndex !== null && i !== focusedDayIndex) continue;

    const curPlaces = (cur.items || []).filter(
      (p): p is PlaceItem => p.type === 'place' && !!p.location?.coordinates
    );
    const nextPlaces = (next.items || []).filter(
      (p): p is PlaceItem => p.type === 'place' && !!p.location?.coordinates
    );
    if (curPlaces.length === 0 || nextPlaces.length === 0) continue;

    const last = curPlaces[curPlaces.length - 1];
    const firstNext = nextPlaces[0];
    if (!last || !firstNext) continue;

    const originGeo = { type: 'Point' as const, coordinates: last.location!.coordinates };
    const destGeo = { type: 'Point' as const, coordinates: firstNext.location!.coordinates };

    const hashKey = `cross-${cur.id}-to-${next.id}-hash`;
    const cacheKey = `cross-${cur.id}-to-${next.id}`;
    const newHash =
      `${last.id || last.name}:${last.location!.coordinates.join(',')}|` +
      `${firstNext.id || firstNext.name}:${firstNext.location!.coordinates.join(',')}`;

    const oldHash = localStorage.getItem(hashKey);
    const cached = localStorage.getItem(cacheKey);

    if (cached && oldHash === newHash) {
      try {
        const { geometry, savedAt } = JSON.parse(cached);
        const isExpired = Date.now() - savedAt > 1000 * 60 * 60 * 6;
        if (!isExpired && geometry?.coordinates) {
          console.log(`[MAP] ✅ Using cached cross-day route: ${cur.id} → ${next.id}`);
          const path = geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lng, lat }));
          const line = new google.maps.Polyline({
            path,
            strokeColor: '#888',
            strokeOpacity: 0.65,
            strokeWeight: 3,
            map,
          });
          crossDayLines.push(line);
          continue;
        }
      } catch (err) {
        console.warn(`[MAP] Cache parse failed for cross-day ${cur.id} → ${next.id}`, err);
      }
    }

    console.log(`[MAP] 🩶 Fetching new cross-day route: ${cur.id} → ${next.id}`);
    const cross = await getDirections(originGeo, destGeo, [], { force: true });
    if (cross.success && cross.route?.geometry?.coordinates) {
      const path = cross.route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lng, lat }));
      const line = new google.maps.Polyline({
        path,
        strokeColor: '#888',
        strokeOpacity: 0.65,
        strokeWeight: 3,
        map,
      });
      crossDayLines.push(line);
      localStorage.setItem(cacheKey, JSON.stringify({ geometry: cross.route.geometry, savedAt: Date.now() }));
      localStorage.setItem(hashKey, newHash);
      console.log(`[MAP] 💾 Cached new cross-day route: ${cur.id} → ${next.id}`);
    } else {
      console.warn(`[MAP] ⚠️ Cross-day route failed: ${cur.id} → ${next.id}`);
    }
  }
}

// --- Autocomplete ---
export function attachAutocompleteWhenReady(
  inputEl: HTMLInputElement,
  onPlaceSelected: (placeData: any) => void
): void {
  if (!mapsApiReady) {
    mapReadyPromise.then(() => attachAutocompleteWhenReady(inputEl, onPlaceSelected));
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

import { showDaySelectionPopup } from '../pages/planner/index.js';
import { renderPlaceDetailsPanel } from './PlaceDetailsPanel.js';
import { appState } from '../state/index.js';
import { CONFIG } from '../services/config.js';

let map;
let markers = [];
let dailyDirectionRenderers = [];
let geocoder;
let directionsService;
let mapsApiReady = false;
let currentRenderSession = 0;
let temporaryMarker = null;

// สร้าง Promise และตัว resolver ไว้ล่วงหน้า
let mapReadyPromiseResolver;
const mapReadyPromise = new Promise(resolve => {
  mapReadyPromiseResolver = resolve;
});

export function clearTemporaryMarker() {
  if (temporaryMarker) { temporaryMarker.setMap(null); temporaryMarker = null; }
}

function panToAndHighlightPlace(placeLike) {
  clearTemporaryMarker();
  const loc =
    placeLike.location ||
    placeLike.geometry?.location ||
    (placeLike.lat && placeLike.lng ? new google.maps.LatLng(placeLike.lat, placeLike.lng) : null);
  if (!loc) return;
  map.panTo(loc);
  map.setZoom(15);
  temporaryMarker = new google.maps.Marker({
    position: loc, map, animation: google.maps.Animation.DROP,
    icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#d9534f', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 9 }
  });
}

function debounce(fn, wait){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); }; }
function createColoredMarkerIcon(color){ return { path: google.maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 11 }; }
function buildV1PhotoUrl(photoObj, w=200, h=200){ return (photoObj && typeof photoObj.createUrl==='function') ? photoObj.createUrl({maxWidth:w,maxHeight:h}) : ''; }

export async function fetchAndDisplayPlaceDetails(placeId, dayIndex = null) {
  try {
    const place = new google.maps.places.Place({ id: placeId, requestedLanguage: 'th', requestedRegion: 'TH' });
    const { data } = await place.fetchFields({
      fields: ['id','displayName','formattedAddress','location','rating','userRatingCount','currentOpeningHours','nationalPhoneNumber','editorialSummary','photos','googleMapsUri']
    });
    const photoUri = (data.photos && data.photos.length>0 && buildV1PhotoUrl(data.photos[0], 400, 300)) || '';
    const adapted = {
      place_id: data.id, name: data.displayName?.text || '', formatted_address_th: data.formattedAddress || '',
      geometry: { location: data.location }, rating: data.rating, user_ratings_total: data.userRatingCount,
      formatted_phone_number: data.nationalPhoneNumber,
      editorial_summary: data.editorialSummary ? { overview: data.editorialSummary.text || '' } : undefined,
      opening_hours: { open_now: data.currentOpeningHours?.openNow ?? null, weekday_text: data.currentOpeningHours?.weekdayDescriptions || [] },
      url: data.googleMapsUri || '', photoUri
    };
    panToAndHighlightPlace({ location: data.location });
    renderPlaceDetailsPanel(adapted, dayIndex);
    return;
  } catch (err) { console.warn('V1 Place() failed, fallback to legacy PlacesService:', err); }

  try {
    const svc = new google.maps.places.PlacesService(map);
    const req = { placeId, fields: ['place_id','name','formatted_address','geometry','rating','user_ratings_total','opening_hours','formatted_phone_number','url','photos','editorial_summary'] };
    svc.getDetails(req, (place, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place) { console.error('Place details (legacy) failed:', status); return; }
      let photoUri = ''; try { photoUri = place.photos?.[0]?.getUrl?.({ maxWidth: 400, maxHeight: 300 }) || ''; } catch {}
      const adapted = {
        place_id: place.place_id, name: place.name || '', formatted_address: place.formatted_address || '',
        geometry: place.geometry, rating: place.rating, user_ratings_total: place.user_ratings_total,
        formatted_phone_number: place.formatted_phone_number, editorial_summary: place.editorial_summary,
        opening_hours: { open_now: place.opening_hours?.isOpen ? place.opening_hours.isOpen() : place.opening_hours?.open_now ?? null, weekday_text: place.opening_hours?.weekday_text || [] },
        url: place.url || '', photoUri
      };
      panToAndHighlightPlace(place);
      renderPlaceDetailsPanel(adapted, dayIndex);
    });
  } catch (e) { console.error('Place details load failed:', e); }
}

function onMapsApiLoaded() {
  const center = { lat: 13.7563, lng: 100.5018 };
  map = new google.maps.Map(document.getElementById('map'), { center, zoom: 12, clickableIcons: true, gestureHandling: 'greedy', });
  geocoder = new google.maps.Geocoder();
  directionsService = new google.maps.DirectionsService();
  map.addListener('click', (e) => {
    clearTemporaryMarker();
    if (e.placeId) { e.stop(); fetchAndDisplayPlaceDetails(e.placeId); return; }
    geocoder.geocode({ location: e.latLng }, (results, status) => {
      const loc = e.latLng; let placeData;
      if (status === 'OK' && results && results[0]) {
        placeData = { name: results[0].formatted_address, formatted_address: results[0].formatted_address, geometry: { location: loc } };
      } else {
        placeData = { name: `Pinned Location (${loc.lat().toFixed(4)}, ${loc.lng().toFixed(4)})`, formatted_address: 'No address found', geometry: { location: loc } };
      }
      panToAndHighlightPlace(placeData);
      renderPlaceDetailsPanel(placeData);
    });
  });
  mapsApiReady = true;
  mapReadyPromiseResolver(); // บอกให้ Promise รู้ว่าแผนที่พร้อมแล้ว
}

export function initMap() {
  window.onMapsApiLoaded = onMapsApiLoaded;
  const key = encodeURIComponent(CONFIG.GOOGLE_MAPS_API_KEY);
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,directions&v=weekly&language=th&region=TH&callback=onMapsApiLoaded`;
  script.async = true;
  script.defer = true;
  script.onerror = () => console.error("Google Maps script failed to load.");
  document.head.appendChild(script);

  return mapReadyPromise;
}

const debouncedRouteCalculation = debounce((routesToCalc, renderSession) => {
  dailyDirectionRenderers.forEach(r => r.setMap(null)); dailyDirectionRenderers = [];
  routesToCalc.forEach((routeInfo) => {
    const req = { origin: routeInfo.origin, destination: routeInfo.destination, waypoints: routeInfo.waypoints, travelMode: google.maps.TravelMode.DRIVING };
    directionsService.route(req, (result, status) => {
      if (renderSession !== currentRenderSession) return;
      if (status === 'OK') {
        const renderer = new google.maps.DirectionsRenderer({
          map, directions: result, suppressMarkers: true,
          polylineOptions: { strokeColor: routeInfo.color, strokeWeight: 5, strokeOpacity: 0.8 }
        });
        dailyDirectionRenderers.push(renderer);
      } else { console.warn(`Directions failed: ${status}`); }
    });
  });
}, 500);

export function renderMapMarkersAndRoute() {
  if (!mapsApiReady) return;
  currentRenderSession++;
  const days = appState.currentTrip.days;
  const focusedDayIndex = appState.activeDayIndex;

  markers.forEach(m => m.setMap(null)); markers = [];
  if (!days || days.length === 0) { debouncedRouteCalculation([], currentRenderSession); return; }

  const bounds = new google.maps.LatLngBounds();
  let overallIndex = 1;
  const routesToCalc = [];

  days.forEach((day, dayIndex) => {
    const placesOnly = day.items ? day.items.filter(i => i.type === 'place' && i.location) : [];
    const isVisible = focusedDayIndex === null || focusedDayIndex === dayIndex;
    if (isVisible && placesOnly.length > 0) {
      placesOnly.forEach((p) => {
        const position = { lat: p.location.lat, lng: p.location.lng };
        const marker = new google.maps.Marker({
          position, map, icon: createColoredMarkerIcon(day.color),
          label: { text: String(overallIndex), color: 'white', fontWeight: 'bold' }, title: p.name
        });
        markers.push(marker);
        bounds.extend(position);
        overallIndex++;
      });
    }
  });

  const daysToRoute = focusedDayIndex !== null && days[focusedDayIndex] ? [days[focusedDayIndex]] : days;
  daysToRoute.forEach((day) => {
    const placesOnly = day.items ? day.items.filter(i => i.type === 'place' && i.location) : [];
    if (placesOnly.length >= 2) {
      routesToCalc.push({
        origin: placesOnly[0].location,
        destination: placesOnly[placesOnly.length - 1].location,
        waypoints: placesOnly.slice(1, -1).map(p => ({ location: p.location, stopover: true })),
        color: day.color
      });
    }
  });

  if (focusedDayIndex !== null && days[focusedDayIndex + 1]) {
    const curr = (days[focusedDayIndex].items || []).filter(i => i.type === 'place' && i.location);
    const next = (days[focusedDayIndex + 1].items || []).filter(i => i.type === 'place' && i.location);
    if (curr.length > 0 && next.length > 0) {
      const lastPlace = curr[curr.length - 1];
      const firstNext = next[0];
      const nextMarker = new google.maps.Marker({
        position: firstNext.location, map, icon: createColoredMarkerIcon('#808080'),
        label: { text: '→', color: 'white', fontWeight: 'bold', fontSize: '14px' }, title: `To: ${firstNext.name}`
      });
      markers.push(nextMarker);
      bounds.extend(firstNext.location);
      routesToCalc.push({ origin: lastPlace.location, destination: firstNext.location, waypoints: [], color: '#808080' });
    }
  }

  debouncedRouteCalculation(routesToCalc, currentRenderSession);
  if (markers.length > 0) { map.fitBounds(bounds); if (map.getZoom() > 17) map.setZoom(17); }
}

export function attachAutocompleteWhenReady(inputEl, onPlaceSelected) {
  if (!mapsApiReady) {
    console.warn('Maps API not ready, waiting to attach Autocomplete.');
    mapReadyPromise.then(() => attachAutocompleteWhenReady(inputEl, onPlaceSelected));
    return;
  }
  const autocomplete = new google.maps.places.Autocomplete(inputEl, {
    types: ['establishment', 'geocode'], componentRestrictions: { country: 'th' }
  });
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    onPlaceSelected({
      name: place.name || place.formatted_address,
      place_id: place.place_id,
      location: place.geometry.location.toJSON(),
      raw: place
    });
  });
}

export async function getDirectionsBetweenTwoPoints(origin, destination) {
  if (!mapsApiReady) await mapReadyPromise;
  if (!directionsService) return null;
  
  const request = { origin, destination, travelMode: google.maps.TravelMode.DRIVING };
  try {
    const result = await directionsService.route(request);
    if (result.status === 'OK') return result.routes[0];
    return null;
  } catch (e) { console.error('Single directions request failed', e); return null; }
}
// src/components/PlaceDetailsPanel.ts
import { showDaySelectionPopup, handleAppRender } from '../pages/planner/index.js';
import { addPlaceToDay } from '../state/index.js';
import { clearTemporaryMarker } from './Map.js';

export interface PlaceDetails {
  id?: string;
  place_id?: string;
  name?: string;
  displayName?: { text: string };
  formatted_address?: string;
  formattedAddress?: string;
  formatted_address_th?: string;
  vicinity?: string;
  geometry?: { location: any };
  location?: { lat: number, lng: number };
  rating?: number;
  user_ratings_total?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow: boolean | null, weekdayDescriptions: string[] };
  opening_hours?: { open_now: boolean | null, weekday_text: string[] };
  weekdayDescriptions?: string[];
  formatted_phone_number?: string;
  nationalPhoneNumber?: string;
  editorial_summary?: { overview: string };
  editorialSummary?: { overview: string };
  photos?: any[];
  photoUri?: string;
  url?: string;
  googleMapsUri?: string;
}

declare global {
    interface Window {
        DOMPurify: { sanitize: (dirty: string) => string; };
    }
}

const panel = document.getElementById('place-details-panel');

function renderStars(rating: number): string {
  let s = '';
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  for (let i = 0; i < full; i++) s += "<i class='bx bxs-star'></i>";
  if (half) s += "<i class='bx bxs-star-half'></i>";
  for (let i = 0; i < 5 - full - (half ? 1 : 0); i++) s += "<i class='bx bx-star'></i>";
  return s;
}

function getStaticMapUrl(lat: number, lng: number, w: number = 320, h: number = 200): string {
  const key = encodeURIComponent(window.GOOGLE_MAPS_API_KEY || '');
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=${w}x${h}&markers=color:red|${lat},${lng}&key=${key}`;
}

function pickName(place: PlaceDetails): string { return place.displayName?.text || place.name || 'ไม่ทราบชื่อ'; }
function pickAddress(place: PlaceDetails): string { return place.formatted_address_th || place.formatted_address || place.formattedAddress || place.vicinity || ''; }
function pickPhoto(place: PlaceDetails): string {
    if (place.photoUri) return place.photoUri;
    try { return place.photos?.[0]?.getUrl?.({ maxWidth: 400, maxHeight: 300 }) || ''; } catch { return ''; }
}
function normalizeHours(place: PlaceDetails): { openNow: boolean | null, weekdayText: string[] } {
    const openNow = place.opening_hours?.open_now ?? place.currentOpeningHours?.openNow ?? null;
    const weekdayText = place.opening_hours?.weekday_text || place.currentOpeningHours?.weekdayDescriptions || place.weekdayDescriptions || [];
    return { openNow, weekdayText };
}
function pickEditorial(place: PlaceDetails): string { return place.editorial_summary?.overview || place.editorialSummary?.overview || ''; }
function pickLatLng(place: PlaceDetails): { lat: number | null, lng: number | null } {
    const location = place.geometry?.location || place.location;
    const lat = typeof location?.lat === 'function' ? location.lat() : location?.lat ?? null;
    const lng = typeof location?.lng === 'function' ? location.lng() : location?.lng ?? null;
    return { lat, lng };
}


export function renderPlaceDetailsPanel(place: PlaceDetails, dayIndex: number | null = null): void {
  if (!panel) return;
  
  const name = pickName(place);
  const address = pickAddress(place);
  const { lat, lng } = pickLatLng(place);
  const { openNow, weekdayText } = normalizeHours(place);
  const overview = pickEditorial(place);
  const photoUrl = pickPhoto(place);
  const showPhoto = !!photoUrl || (lat != null && lng != null);
  const rating = place.rating;
  const totalRatings = place.user_ratings_total ?? place.userRatingCount ?? null;
  const gmapsHref = place.url || place.googleMapsUri || (lat != null && lng != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${place.place_id}` : '');
  const phone = place.formatted_phone_number || place.nationalPhoneNumber;

  panel.innerHTML = '';
  
  const header = document.createElement('div');
  header.className='panel-header';
  const headerText = document.createElement('div');
  headerText.className='panel-header-text';
  const h3 = document.createElement('h3');
  h3.textContent = name;
  const addrP = document.createElement('p');
  addrP.textContent = address;
  headerText.append(h3, addrP);

  if (showPhoto && lat && lng) {
    const photoImg = document.createElement('img');
    photoImg.className = 'panel-photo';
    photoImg.alt = name;
    photoImg.src = photoUrl || getStaticMapUrl(lat, lng);
    photoImg.addEventListener('error', () => { if(lat && lng) photoImg.src = getStaticMapUrl(lat, lng); });
    header.appendChild(photoImg);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'panel-close-btn';
  closeBtn.title = 'Close';
  closeBtn.innerHTML = "<i class='bx bx-x'></i>";
  closeBtn.addEventListener('click', hidePlaceDetailsPanel);
  header.insertBefore(headerText, header.firstChild);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className='panel-body';

  if (overview) {
      const summary = document.createElement('div');
      summary.className='panel-section summary';
      const p = document.createElement('p');
      if (window.DOMPurify) p.innerHTML = window.DOMPurify.sanitize(overview);
      else p.textContent = overview;
      summary.appendChild(p);
      body.appendChild(summary);
  }

  if (rating) {
      const sec = document.createElement('div');
      sec.className='panel-section';
      sec.innerHTML = `<i class='bx bxs-star'></i><div class='rating-text'><span class='rating-stars'>${renderStars(rating)}</span><strong>${String(rating)}</strong>${totalRatings != null ? `<span class='total-ratings'> (${totalRatings} ratings)</span>` : ''}</div>`;
      body.appendChild(sec);
  }
  
  // 🔽 นำตัวแปร openNow และ weekdayText มาใช้งานตรงนี้ 🔽
  const hasHours = (weekdayText && weekdayText.length > 0) || openNow !== null;
  if (hasHours) {
    const hoursSection = document.createElement('div');
    hoursSection.className = 'hours-section';
    
    let statusText = 'Hours';
    if (openNow === true) statusText = 'Open now';
    if (openNow === false) statusText = 'Closed now';
    
    hoursSection.innerHTML = `
        <div class="panel-section">
            <i class='bx bx-time-five'></i>
            <span>${statusText}</span>
            ${weekdayText.length > 0 ? `<a class='hours-toggle show-times-btn'>Show times</a><a class='hours-toggle hide-times-btn'>Hide times</a>` : ''}
        </div>
        <ul class='hours-list'>
            ${weekdayText.map(line => `<li>${line}</li>`).join('')}
        </ul>
    `;
    hoursSection.addEventListener('click', (e) => { 
        if ((e.target as HTMLElement).classList.contains('hours-toggle')) {
            hoursSection.classList.toggle('hours-expanded');
        }
    });
    body.appendChild(hoursSection);
  }

  if (phone) {
    const sec = document.createElement('div');
    sec.className = 'panel-section';
    sec.innerHTML = `<i class='bx bxs-phone'></i><span>${phone}</span>`;
    body.appendChild(sec);
  }

  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add';
  addBtn.textContent = 'Add to Plan';
  addBtn.addEventListener('click', () => {
    const pid = place.place_id || place.id || '';
    if (dayIndex !== null && lat !== null && lng !== null) { 
      addPlaceToDay(dayIndex, name, lat, lng, pid); 
      handleAppRender();
      hidePlaceDetailsPanel(); 
    }
    else if (lat !== null && lng !== null) { 
      showDaySelectionPopup(name, lat, lng, pid); 
    }
  });
  actions.appendChild(addBtn);

  if (gmapsHref) {
      const gmapsLink = document.createElement('a');
      gmapsLink.href = gmapsHref;
      gmapsLink.target = '_blank';
      gmapsLink.className = 'btn-gmaps';
      gmapsLink.textContent = 'View on Google Maps';
      actions.appendChild(gmapsLink);
  }
  
  panel.append(header, body, actions);
  panel.classList.add('active');
}

export function hidePlaceDetailsPanel(): void {
  if (!panel) return;
  clearTemporaryMarker();
  const onEnd = () => { if(panel) { panel.innerHTML = ''; panel.removeEventListener('transitionend', onEnd); } };
  panel.addEventListener('transitionend', onEnd);
  panel.classList.remove('active');
}
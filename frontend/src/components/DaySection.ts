import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js';
import { handleAppRender } from '../pages/planner/index.js';
import { attachAutocompleteWhenReady, getDirectionsBetweenTwoPoints, fetchAndDisplayPlaceDetails } from './Map.js';
import { prettyDate, escapeHtml, debounce } from '../helpers/utils.js';
import { createPlaceCardElement } from './PlaceCard.js';
import { createNoteCardElement } from './NoteCard.js';
// 🔽 1. แก้ไข: import Type ทั้งหมดมาจากที่ใหม่ที่เดียว 🔽
import type { Day, DayItem, PlaceItem, NoteItem, GeoJSONPoint } from '../types.js';

const DAILY_TIME_LIMIT_MINUTES = 1440;

function calculateStayDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  try {
    const [sh, sm] = startTime.split(':');
    const [eh, em] = endTime.split(':');
    let start = (+sh) * 60 + (+sm);
    let end = (+eh) * 60 + (+em);

    if (end < start) {
      end += 1440;
    }
    
    return end - start;
  } catch { 
    return 0; 
  }
}

async function renderDaySummaryAndValidation(day: Day, dayIndex: number): Promise<void> {
  // 🔽 2. แก้ไข: ใช้ Type Guard ที่ถูกต้อง 🔽
  const places = day.items.filter((i): i is PlaceItem => i.type === 'place');
  let totalTravelSeconds = 0;
  let totalStayMinutes = 0;
  places.forEach(p => { 
    if (p.startTime && p.endTime) {
      totalStayMinutes += calculateStayDuration(p.startTime, p.endTime);
    }
  });

  const placesWithLoc = places.filter(p => p.location);
  const routePromises = [];
  for (let i=0; i < placesWithLoc.length - 1; i++) {
    // เพิ่มการตรวจสอบเพื่อให้แน่ใจว่า location และ coordinates มีอยู่จริง
    const origin = placesWithLoc[i]?.location?.coordinates;
    const destination = placesWithLoc[i+1]?.location?.coordinates;
    if (origin && destination) {
      routePromises.push(getDirectionsBetweenTwoPoints({lng: origin[0], lat: origin[1]}, {lng: destination[0], lat: destination[1]}));
    }
  }
  const routes = await Promise.all(routePromises);
  
  routes.forEach((route, i) => {
    if (route?.legs?.[0]?.duration && route.legs[0].distance) {
      const leg = route.legs[0];
      totalTravelSeconds += leg.duration.value;
      const fromItemIndex = day.items.indexOf(placesWithLoc[i]);
      const travelInfoEl = document.getElementById(`travel-info-${dayIndex}-${fromItemIndex}`);
      if (travelInfoEl) {
        travelInfoEl.innerHTML = `<i class='bx bxs-car'></i><span>${leg.duration.text}</span> · <span>${leg.distance.text}</span>`;
      }
    }
  });
  
  const totalTravelMinutes = Math.round(totalTravelSeconds/60);
  const totalDailyMinutes = totalTravelMinutes + totalStayMinutes;

  const summaryEl = document.getElementById(`day-summary-${dayIndex}`);
  if (summaryEl) {
    const hours = Math.floor(totalDailyMinutes/60);
    const minutes = totalDailyMinutes % 60;
    const totalDurationText = `${hours > 0 ? hours + " hr" : ""} ${minutes} min`;
    summaryEl.innerHTML = `<span><strong>Total Time (Travel + Stays):</strong> ${totalDurationText}</span>`;
  }

  const warningEl = document.getElementById(`day-warning-${dayIndex}`);
  if (warningEl) {
    if (totalDailyMinutes > DAILY_TIME_LIMIT_MINUTES) {
      const overageMinutes = totalDailyMinutes - DAILY_TIME_LIMIT_MINUTES;
      const overageHours = Math.floor(overageMinutes/60);
      const overageMins = overageMinutes % 60;
      const limitHours = DAILY_TIME_LIMIT_MINUTES/60;
      warningEl.innerHTML = `<i class='bx bxs-error-alt'></i>
        <span>This day is over the suggested limit of ${limitHours} hours by **${overageHours > 0 ? overageHours + ' hr' : ''} ${overageMins} min**. Consider moving some items to another day.</span>`;
    } else { warningEl.innerHTML = ''; }
  }
}

function renderItems(day: Day, dayIndex: number, container: HTMLElement): void {
  container.innerHTML = '';
  if (!day.items) day.items = [];

  const placesOnly = day.items.filter((item): item is PlaceItem => item.type === 'place');
  const firstPlaceId = placesOnly.length > 0 ? placesOnly[0].id : null;
  const lastPlaceId = placesOnly.length > 0 ? placesOnly[placesOnly.length - 1].id : null;

  day.items.forEach((item: DayItem, itemIndex: number) => {
    let el: HTMLElement | undefined; // ⬅️ 3. แก้ไข: กำหนดให้ el อาจเป็น undefined ได้
    switch(item.type){
      case 'place':
        const isFirst = item.id === firstPlaceId;
        const isLast = item.id === lastPlaceId;
        el = createPlaceCardElement(item, itemIndex, dayIndex, day.color, isFirst, isLast);
        break;
      case 'note': 
        el = createNoteCardElement(item, itemIndex, dayIndex); 
        break;
    }
    if (el) container.appendChild(el);
  });
}

export function createDaySectionElement(day: Day, dayIndex: number): HTMLDivElement {
  const daySection = document.createElement('div');
  daySection.className = 'day-section';
  daySection.id = `day-section-${dayIndex}`;
  daySection.dataset.dayIdx = String(dayIndex);
  daySection.innerHTML = `
    <div class="day-header-section">
      <h2 class="day-title">${prettyDate(day.date)}</h2>
      <button class="optimize-btn"><i class='bx bx-git-branch'></i> Optimize route</button>
    </div>
    <div class="day-subheading-section">
      <input class="subheading" placeholder="Add subheading..." value="${escapeHtml(day.subheading || '')}" />
    </div>
    <div class="place-search-box">
      <div class="search-input-container">
        <input class="add-place-input" placeholder="Add a place" />
        <i class='bx bx-search'></i>
      </div>
      <button class="add-note-btn" title="Add Note"><i class='bx bx-file'></i></button>
    </div>
    <div class="day-items"></div>
    <div class="day-summary" id="day-summary-${dayIndex}"></div>
    <div class="day-validation-warning" id="day-warning-${dayIndex}"></div>
  `;

  const itemsContainer = daySection.querySelector<HTMLElement>('.day-items');
  if(itemsContainer) {
    renderItems(day, dayIndex, itemsContainer);
  }
  renderDaySummaryAndValidation(day, dayIndex);

  const debouncedSave = debounce(async () => {
      const tripService = await getTripService();
      await tripService.saveCurrentTrip();
  }, 500);

  const subheadingInput = daySection.querySelector<HTMLInputElement>('.subheading');
  if(subheadingInput) {
    subheadingInput.addEventListener('input', (e: Event) => {
      if (appState.currentTrip?.days[dayIndex]) {
        appState.currentTrip.days[dayIndex].subheading = (e.target as HTMLInputElement).value;
        debouncedSave();
      }
    });
  }

  const searchInput = daySection.querySelector<HTMLInputElement>('.add-place-input');
  if(searchInput) {
    attachAutocompleteWhenReady(searchInput, (placeData) => {
      if (placeData.place_id) fetchAndDisplayPlaceDetails(placeData.place_id, dayIndex);
      searchInput.value = '';
    });
  }

  const addNoteButton = daySection.querySelector<HTMLButtonElement>('.add-note-btn');
  if(addNoteButton) {
    addNoteButton.addEventListener('click', async () => {
      const newNote: NoteItem = { type: 'note', id: 'n' + Date.now() };
      if (appState.currentTrip?.days[dayIndex]) {
        if (!appState.currentTrip.days[dayIndex].items) {
            appState.currentTrip.days[dayIndex].items = [];
        }
        appState.currentTrip.days[dayIndex].items.push(newNote);
        
        const tripService = await getTripService();
        await tripService.saveCurrentTrip();
        handleAppRender();
      }
    });
  }

  return daySection;
}
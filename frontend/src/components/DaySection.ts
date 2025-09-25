import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js';
import { handleAppRender } from '../pages/planner/index.js';
import { attachAutocompleteWhenReady, getDirectionsBetweenTwoPoints, fetchAndDisplayPlaceDetails } from './Map.js';
import { prettyDate, escapeHtml, debounce } from '../helpers/utils.js';
import { createPlaceCardElement } from './PlaceCard.js';
import { createNoteCardElement } from './NoteCard.js';

const DAILY_TIME_LIMIT_MINUTES = 1440;

function calculateStayDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  try {
    const [sh, sm] = startTime.split(':');
    const [eh, em] = endTime.split(':');
    let start = (+sh) * 60 + (+sm);
    let end = (+eh) * 60 + (+em);

    if (end < start) {
      // If end time is on the next day, add 24 hours (1440 minutes) to it
      end += 1440;
    }
    
    return end - start;
  } catch { 
    return 0; 
  }
}

async function renderDaySummaryAndValidation(day, dayIndex) {
  const places = day.items.filter(i => i.type === 'place');
  let totalTravelSeconds = 0;
  let totalStayMinutes = 0;
  places.forEach(p => { totalStayMinutes += calculateStayDuration(p.startTime, p.endTime); });

  const placesWithLoc = places.filter(p => p.location);
  const routePromises = [];
  for (let i=0; i < placesWithLoc.length - 1; i++) {
    routePromises.push(getDirectionsBetweenTwoPoints(placesWithLoc[i].location, placesWithLoc[i+1].location));
  }
  const routes = await Promise.all(routePromises);
  routes.forEach((route, i) => {
    if (route && route.legs && route.legs.length > 0) {
      totalTravelSeconds += route.legs[0].duration.value;
      const fromItemIndex = day.items.indexOf(placesWithLoc[i]);
      const travelInfoEl = document.getElementById(`travel-info-${dayIndex}-${fromItemIndex}`);
      if (travelInfoEl) {
        travelInfoEl.innerHTML = `<i class='bx bxs-car'></i><span>${route.legs[0].duration.text}</span> · <span>${route.legs[0].distance.text}</span>`;
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

function renderItems(day, dayIndex, container) {
  container.innerHTML = '';
  if (!day.items) day.items = [];

  // กรองเอาเฉพาะสถานที่ออกมาเพื่อหาลำดับแรก/สุดท้ายที่แท้จริง
  const placesOnly = day.items.filter(item => item.type === 'place');
  const firstPlaceId = placesOnly.length > 0 ? placesOnly[0].id : null;
  const lastPlaceId = placesOnly.length > 0 ? placesOnly[placesOnly.length - 1].id : null;

  day.items.forEach((item, itemIndex) => {
    let el;
    switch(item.type){
      case 'place':
        const isFirst = item.id === firstPlaceId;
        const isLast = item.id === lastPlaceId;
        // ส่ง isFirst และ isLast เป็นพารามิเตอร์เพิ่มเข้าไป
        el = createPlaceCardElement(item, itemIndex, dayIndex, day.color, isFirst, isLast);
        break;
      case 'note': 
        el = createNoteCardElement(item, itemIndex, dayIndex); 
        break;
    }
    if (el) container.appendChild(el);
  });
}

export function createDaySectionElement(day, dayIndex) {
  const daySection = document.createElement('div');
  daySection.className = 'day-section';
  daySection.id = `day-section-${dayIndex}`;
  daySection.dataset.dayIdx = dayIndex;
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

  renderItems(day, dayIndex, daySection.querySelector('.day-items'));
  renderDaySummaryAndValidation(day, dayIndex);

  const debouncedSave = debounce(async () => {
      const tripService = await getTripService();
      await tripService.saveCurrentTrip();
  }, 500);

  const subheadingInput = daySection.querySelector('.subheading');
  subheadingInput.addEventListener('input', (e) => {
    appState.currentTrip.days[dayIndex].subheading = e.target.value;
    debouncedSave();
  });

  const searchInput = daySection.querySelector('.add-place-input');
  attachAutocompleteWhenReady(searchInput, (placeData) => {
    if (placeData.place_id) fetchAndDisplayPlaceDetails(placeData.place_id, dayIndex);
    searchInput.value = '';
  });

  daySection.querySelector('.add-note-btn').addEventListener('click', async () => {
    const newNote = { type: 'note', id: 'n' + Date.now(), text: '' };
    if (!appState.currentTrip.days[dayIndex].items) {
        appState.currentTrip.days[dayIndex].items = [];
    }
    appState.currentTrip.days[dayIndex].items.push(newNote);
    
    const tripService = await getTripService();
    await tripService.saveCurrentTrip();

    handleAppRender();
  });

  return daySection;
}
// src/components/DaySection.ts
import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js';
import { optimizeDayRoute } from '../services/routeService.js';
import { handleAppRender } from '../pages/planner/index.js';
import {
  attachAutocompleteWhenReady,
  fetchAndDisplayPlaceDetails,
  drawRoutePolyline,
} from './Map.js';
import { prettyDate, escapeHtml, debounce, TRIP_COLORS } from '../helpers/utils.js';
import { createPlaceCardElement } from './PlaceCard.js';
import { createNoteCardElement } from './NoteCard.js';
import type { Day, DayItem, PlaceItem, NoteItem } from '../types.js';

const DAILY_TIME_LIMIT_MINUTES = 1440;

function calculateStayDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  try {
    const [sh, sm] = startTime.split(':');
    const [eh, em] = endTime.split(':');
    let start = +sh * 60 + +sm;
    let end = +eh * 60 + +em;
    if (end < start) end += 1440;
    return end - start;
  } catch {
    return 0;
  }
}

function assignDayColor(day: Day, index: number): void {
  day.color = TRIP_COLORS[index % TRIP_COLORS.length];
}

// ⬇⬇⬇  Export ออกไปให้ Itinerary เรียกได้ด้วย
export async function renderDaySummaryAndValidation(day: Day, dayIndex: number): Promise<void> {
  const places = day.items.filter((i): i is PlaceItem => i.type === 'place');
  let totalTravelSeconds = 0;
  let totalStayMinutes = 0;

  places.forEach(p => {
    if (p.startTime && p.endTime) {
      totalStayMinutes += calculateStayDuration(p.startTime, p.endTime);
    }
  });

  const segmentsStr = localStorage.getItem(`day-${day.id}-route-segments`);
  const segments = segmentsStr ? JSON.parse(segmentsStr) : null;
  const placesWithLoc = places.filter(p => p.location);
  const routes: any[] = [];

  for (let i = 0; i < placesWithLoc.length - 1; i++) {
    if (segments && segments[i]) {
      routes.push({
        legs: [{
          distance: { text: `${(segments[i].distance / 1000).toFixed(1)} km`, value: segments[i].distance },
          duration: { text: `${Math.round(segments[i].duration / 60)} min`, value: segments[i].duration },
        }],
      });
    }
  }

  routes.forEach((route: any, i: number) => {
    if (route?.legs?.length > 0) {
      const leg = route.legs[0];
      totalTravelSeconds += leg.duration.value;
      const fromItemIndex = day.items.indexOf(placesWithLoc[i]);
      const travelInfoEl = document.getElementById(`travel-info-${dayIndex}-${fromItemIndex}`);
      if (travelInfoEl) {
        travelInfoEl.innerHTML = `<i class='bx bxs-car'></i><span>${leg.duration.text}</span> · <span>${leg.distance.text}</span>`;
      }
    }
  });

  const totalTravelMinutes = Math.round(totalTravelSeconds / 60);
  const totalDailyMinutes = totalTravelMinutes + totalStayMinutes;

  const summaryEl = document.getElementById(`day-summary-${dayIndex}`);
  if (summaryEl) {
    const hours = Math.floor(totalDailyMinutes / 60);
    const minutes = totalDailyMinutes % 60;
    summaryEl.innerHTML = `<strong>Total Time (Travel + Stays):</strong> ${hours > 0 ? `${hours} hr` : ''} ${minutes} min`;
  }

  const warningEl = document.getElementById(`day-warning-${dayIndex}`);
  if (warningEl) {
    if (totalDailyMinutes > DAILY_TIME_LIMIT_MINUTES) {
      const overage = totalDailyMinutes - DAILY_TIME_LIMIT_MINUTES;
      const overH = Math.floor(overage / 60);
      const overM = overage % 60;
      warningEl.innerHTML = `<i class='bx bxs-error-alt'></i> Over by ${overH > 0 ? `${overH} hr` : ''} ${overM} min`;
    } else {
      warningEl.innerHTML = '';
    }
  }
}

function renderItems(day: Day, dayIndex: number, container: HTMLElement): void {
  container.innerHTML = '';
  if (!day.items) day.items = [];

  const placesOnly = day.items.filter((item): item is PlaceItem => item.type === 'place');
  const firstPlaceId = placesOnly[0]?.id ?? null;
  const lastPlaceId = placesOnly.at(-1)?.id ?? null;

  day.items.forEach((item, itemIndex) => {
    let el: HTMLElement | undefined;

    if (item.type === 'place') {
      const isFirst = item.id === firstPlaceId;
      const isLast = item.id === lastPlaceId;
      el = createPlaceCardElement(item, itemIndex, dayIndex, day.color, isFirst, isLast);
    } else if (item.type === 'note') {
      el = createNoteCardElement(item, itemIndex, dayIndex);
    }

    if (el) container.appendChild(el);
  });
}

export function createDaySectionElement(day: Day, dayIndex: number): HTMLDivElement {
  assignDayColor(day, dayIndex);

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
  if (itemsContainer) renderItems(day, dayIndex, itemsContainer);

  // เรียกรอบแรกทันที
  renderDaySummaryAndValidation(day, dayIndex);

  // 🔁 กันกรณี localStorage เพิ่งถูกเขียนเสร็จช้ากว่า UI
  setTimeout(() => {
    renderDaySummaryAndValidation(day, dayIndex);
    console.log(`[RENDER] Rechecked summary for day ${day.id} (index ${dayIndex})`);
  }, 800);

  const debouncedSave = debounce(async () => {
    const tripService = await getTripService();
    await tripService.saveCurrentTrip();
  }, 500);

  const subheadingInput = daySection.querySelector<HTMLInputElement>('.subheading');
  if (subheadingInput) {
    subheadingInput.addEventListener('input', e => {
      const val = (e.target as HTMLInputElement).value;
      if (appState.currentTrip?.days[dayIndex]) {
        appState.currentTrip.days[dayIndex].subheading = val;
        debouncedSave();
      }
    });
  }

  const searchInput = daySection.querySelector<HTMLInputElement>('.add-place-input');
  if (searchInput) {
    attachAutocompleteWhenReady(searchInput, placeData => {
      if (placeData.place_id) fetchAndDisplayPlaceDetails(placeData.place_id, dayIndex);
      searchInput.value = '';
    });
  }

  const addNoteButton = daySection.querySelector<HTMLButtonElement>('.add-note-btn');
  if (addNoteButton) {
    addNoteButton.addEventListener('click', async () => {
      const newNote: NoteItem = { type: 'note', id: 'n' + Date.now(), text: '' };
      const dayObj = appState.currentTrip?.days[dayIndex];
      if (dayObj) {
        dayObj.items = dayObj.items || [];
        dayObj.items.push(newNote);
        const tripService = await getTripService();
        await tripService.saveCurrentTrip();
        handleAppRender();
      }
    });
  }

  const optimizeButton = daySection.querySelector<HTMLButtonElement>('.optimize-btn');
  if (optimizeButton) {
    optimizeButton.addEventListener('click', async () => {
      const placesToOptimize = day.items.filter(
        (item): item is PlaceItem => item.type === 'place' && !!item.location
      );

      if (placesToOptimize.length < 3) {
        alert('ต้องมีอย่างน้อย 3 สถานที่เพื่อจัดลำดับ');
        return;
      }

      try {
        optimizeButton.disabled = true;
        optimizeButton.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Optimizing...`;

        const result = await optimizeDayRoute(placesToOptimize);
        if (result.success && result.ordered && result.route?.geometry) {
          const ordered = result.ordered!;
          appState.currentTrip.days[dayIndex].items = day.items
            .map(it => (it.type === 'place' ? ordered.find(p => p.id === it.id) || it : it))
            .sort((a, b) => {
              const aIdx = ordered.findIndex(p => p.id === a.id);
              const bIdx = ordered.findIndex(p => p.id === b.id);
              return aIdx - bIdx;
            });

          handleAppRender();
          drawRoutePolyline(day, result.route.geometry);
        } else {
          alert(`Failed: ${result.message || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Optimize error:', err);
        alert('Error while optimizing route.');
      } finally {
        optimizeButton.disabled = false;
        optimizeButton.innerHTML = `<i class='bx bx-git-branch'></i> Optimize route`;
      }
    });
  }

  // --- Listen for route cache updates (real-time UI refresh) ---
  const debouncedRecalc = debounce(() => {
    renderDaySummaryAndValidation(day, dayIndex);
  }, 300);

  window.addEventListener('route-cache-updated', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail?.dayId) return;

    // ✅ ให้ refresh เฉพาะวันเดียวกันเท่านั้น
    if (detail.dayId === day.id) {
      console.log(`[EVENT] route-cache-updated for day ${day.id} → re-render summary`);
      debouncedRecalc();
    }
  });

  return daySection;
}

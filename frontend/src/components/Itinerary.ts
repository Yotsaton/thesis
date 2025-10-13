// src/components/Itinerary.ts
import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js';
import { handleAppRender } from '../pages/planner/index.js';
import { createDaySectionElement, renderDaySummaryAndValidation } from './DaySection.js'; // ⬅️ นำเข้า summary
import { renderMapMarkersAndRoute } from './Map.js';
import { debounce } from '../helpers/utils.js';
import type { Day } from '../types.js';

// --- Sortable Declarations ---
declare class Sortable {
  static create(el: HTMLElement, options: object): Sortable;
  destroy(): void;
}

interface SortableEvent {
  from: HTMLElement;
  to: HTMLElement;
  oldIndex: number | undefined;
  newIndex: number | undefined;
}

interface SortableContainer extends HTMLElement {
  sortableInstance?: Sortable;
}

// --- DOM Reference ---
const mainContent = document.getElementById('main-content') as HTMLElement | null;

// --- Debounce map refresh ---
const refreshMapDebounced = debounce(async () => {
  try {
    await renderMapMarkersAndRoute();
  } catch (err) {
    console.warn('Map refresh failed:', err);
  }
}, 800);

// --- Sortable Initialization ---
function initializeSortable(): void {
  if (!mainContent) return;
  const dayContainers = mainContent.querySelectorAll('.day-items') as NodeListOf<SortableContainer>;

  dayContainers.forEach(container => {
    container.sortableInstance?.destroy();
    container.sortableInstance = Sortable.create(container, {
      group: 'shared-items',
      animation: 150,
      ghostClass: 'sortable-ghost',

      onEnd: async (evt: SortableEvent) => {
        const oldDayEl = evt.from.closest('.day-section') as HTMLElement;
        const newDayEl = evt.to.closest('.day-section') as HTMLElement;
        const oldDayIndex = parseInt(oldDayEl?.dataset.dayIdx || '-1');
        const newDayIndex = parseInt(newDayEl?.dataset.dayIdx || '-1');
        const oldIndex = evt.oldIndex;
        const newIndex = evt.newIndex;
        if (oldDayIndex < 0 || newDayIndex < 0 || oldIndex === undefined || newIndex === undefined)
          return;

        const fromItems = appState.currentTrip.days[oldDayIndex].items;
        const [moved] = fromItems.splice(oldIndex, 1);
        const toItems = appState.currentTrip.days[newDayIndex].items;
        toItems.splice(newIndex, 0, moved);

        console.log('-------------------------');
        console.log('[SORT] Drag-drop completed:', { oldDayIndex, newDayIndex, oldIndex, newIndex });
        console.log('[SORT] Before save:', structuredClone(appState.currentTrip.days));

        try {
          const tripService = await getTripService();
          await tripService.saveCurrentTrip();
        } catch (err) {
          console.warn('Trip save failed after drag-drop:', err);
        }

        // จำวันโฟกัส
        if (typeof appState.activeDayIndex === 'number') {
          (appState as any).lastFocusedDayIndex = appState.activeDayIndex;
        }

        console.log('[SORT] After save. ActiveDayIndex:', appState.activeDayIndex);
        console.log('[SORT] LastFocusedDayIndex:', (appState as any).lastFocusedDayIndex);

        // รอ state sync แล้วค่อย render + สรุปใหม่
          setTimeout(() => {
            // ✅ จดจำวันโฟกัสไว้ก่อน re-render
            (appState as any).lastFocusedDayIndex = newDayIndex;
            appState.activeDayIndex = newDayIndex;

            console.log('[SORT] Trigger handleAppRender()...');
            handleAppRender();

          // 🔁 re-calc summary เฉพาะวันที่ได้รับผลกระทบ (กันเคสเขียน localStorage ช้า)
          setTimeout(() => {
            const dayA: Day | undefined = appState.currentTrip?.days?.[oldDayIndex];
            const dayB: Day | undefined = appState.currentTrip?.days?.[newDayIndex];

            if (dayA) renderDaySummaryAndValidation(dayA, oldDayIndex);
            if (newDayIndex !== oldDayIndex && dayB) renderDaySummaryAndValidation(dayB, newDayIndex);
          }, 600);
        }, 400);
      }
    });
  });
}

// --- Render Itinerary ---
export function renderItinerary(): void {
  if (!mainContent) {
    console.error('Main content container not found!');
    return;
  }

  const savedScroll = mainContent.scrollTop;
  mainContent.innerHTML = '';

  if (!appState.currentTrip?.days?.length) {
    const msg = document.createElement('p');
    msg.textContent = 'Select a travel date to start planning your itinerary.';
    msg.style.textAlign = 'center';
    msg.style.color = '#888';
    msg.style.marginTop = '50px';
    mainContent.appendChild(msg);
    refreshMapDebounced();
    return;
  }

  appState.currentTrip.days.forEach((day: Day, idx: number) => {
    const dayEl = createDaySectionElement(day, idx);
    mainContent.appendChild(dayEl);
  });

  refreshMapDebounced();
  initializeSortable();

  setTimeout(() => {
    mainContent.scrollTop = savedScroll;
  }, 0);
}

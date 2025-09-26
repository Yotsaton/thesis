import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js';
import { handleAppRender } from '../pages/planner/index.js';
import { createDaySectionElement } from './DaySection.js';
import { renderMapMarkersAndRoute } from './Map.js';
import type { Day } from '../types.js'; // ⬅️ 1. แก้ไข: import Type จากที่ใหม่

// --- Type Definitions ---
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


// --- DOM Element ---
const mainContent: HTMLElement | null = document.getElementById('main-content');


// --- Functions ---
function initializeSortable(): void {
  if (!mainContent) return;
  
  const dayItemsContainers: NodeListOf<SortableContainer> = mainContent.querySelectorAll('.day-items');
  
  dayItemsContainers.forEach(container => {
    if (container.sortableInstance) {
        container.sortableInstance.destroy();
    }
    container.sortableInstance = Sortable.create(container, {
      group: 'shared-items',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: async (evt: SortableEvent) => {
        const oldDayEl = evt.from.closest('.day-section') as HTMLElement;
        const newDayEl = evt.to.closest('.day-section') as HTMLElement;

        const oldDayIndex = parseInt(oldDayEl?.dataset.dayIdx || '-1');
        const newDayIndex = parseInt(newDayEl?.dataset.dayIdx || '-1');
        const oldElementIndex = evt.oldIndex;
        const newElementIndex = evt.newIndex;
        
        if (oldDayIndex < 0 || newDayIndex < 0 || oldElementIndex === undefined || newElementIndex === undefined) {
            console.error('Sortable event failed to provide necessary data.');
            return;
        }

        const fromItems = appState.currentTrip.days[oldDayIndex].items;
        const [movedItem] = fromItems.splice(oldElementIndex, 1);
        
        const toItems = appState.currentTrip.days[newDayIndex].items;
        toItems.splice(newElementIndex, 0, movedItem);

        const tripService = await getTripService();
        await tripService.saveCurrentTrip();
        
        handleAppRender();
      },
    });
  });
}

export function renderItinerary(): void {
  if (!mainContent) {
      console.error("Main content container not found!");
      return;
  }
  
  const savedScrollTop = mainContent.scrollTop;
  mainContent.innerHTML = '';

  if (!appState.currentTrip?.days || appState.currentTrip.days.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'Select a travel date to start planning your itinerary.';
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.color = '#888';
    emptyMessage.style.marginTop = '50px';
    mainContent.appendChild(emptyMessage);
    renderMapMarkersAndRoute();
    return;
  }

  appState.currentTrip.days.forEach((day: Day, idx: number) => {
    const dayElement = createDaySectionElement(day, idx);
    mainContent.appendChild(dayElement);
  });
  
  renderMapMarkersAndRoute();
  initializeSortable();

  setTimeout(() => { mainContent.scrollTop = savedScrollTop; }, 0);
}
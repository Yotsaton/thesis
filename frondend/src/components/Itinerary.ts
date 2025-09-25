import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js';
import { handleAppRender } from '../pages/planner/index.js';
import { createDaySectionElement } from './DaySection.js';
import { renderMapMarkersAndRoute } from './Map.js';

const mainContent = document.getElementById('main-content');

function initializeSortable() {
  const dayItemsContainers = mainContent.querySelectorAll('.day-items');
  dayItemsContainers.forEach(container => {
    if (container.sortableInstance) {
        container.sortableInstance.destroy();
    }
    container.sortableInstance = new Sortable(container, {
      group: 'shared-items',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: async (evt) => {
        const oldDayIndex = parseInt(evt.from.closest('.day-section').dataset.dayIdx);
        const newDayIndex = parseInt(evt.to.closest('.day-section').dataset.dayIdx);
        const oldElementIndex = evt.oldIndex;
        const newElementIndex = evt.newIndex;

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

export function renderItinerary() {
  const savedScrollTop = mainContent.scrollTop;
  mainContent.innerHTML = '';

  if (!appState.currentTrip || !appState.currentTrip.days || appState.currentTrip.days.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'Select a travel date to start planning your itinerary.';
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.color = '#888';
    emptyMessage.style.marginTop = '50px';
    mainContent.appendChild(emptyMessage);
    renderMapMarkersAndRoute();
    return;
  }

  appState.currentTrip.days.forEach((day, idx) => {
    const dayElement = createDaySectionElement(day, idx);
    mainContent.appendChild(dayElement);
  });
  
  // Note: renderMapMarkersAndRoute is called within handleAppRender,
  // but we call it here too to ensure map updates if itinerary is empty.
  renderMapMarkersAndRoute();

  initializeSortable();
  setTimeout(() => { mainContent.scrollTop = savedScrollTop; }, 0);
}
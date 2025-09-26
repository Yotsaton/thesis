//src/components/Sidebar.ts
import { appState, setActiveDayIndex } from '../state/index.js';
import { formatDayLabel } from '../helpers/utils.js';
import { handleAppRender, handleScrollToDay } from '../pages/planner/index.js';
import type { Day } from '../types.js'; // ⬅️ 1. แก้ไข: import Type จากที่ใหม่

const itineraryList: HTMLElement | null = document.getElementById('itinerary-list');

export function renderSidebar(): void {
  if (!itineraryList) {
    console.error("Sidebar container 'itinerary-list' not found!");
    return;
  }
  
  const savedScrollTop = itineraryList.scrollTop;
  itineraryList.innerHTML = '';

  if (appState.currentTrip && appState.currentTrip.days) {
    appState.currentTrip.days.forEach((day: Day, idx: number) => {
      const li = document.createElement('li');
      li.textContent = formatDayLabel(day.date);
      li.dataset.idx = String(idx);
      
      if (idx === appState.activeDayIndex) {
        li.classList.add('active');
      }
      
      li.addEventListener('click', () => {
        setActiveDayIndex(idx);
        handleAppRender();
        handleScrollToDay(idx);
      });

      itineraryList.appendChild(li);
    });
  }
  itineraryList.scrollTop = savedScrollTop;
}
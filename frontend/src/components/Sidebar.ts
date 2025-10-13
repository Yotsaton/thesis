import { appState, setActiveDayIndex } from '../state/index.js';
import { formatDayLabel } from '../helpers/utils.js';
import { handleAppRender, handleScrollToDay } from '../pages/planner/index.js';
import type { Day } from '../types.js';

const itineraryList: HTMLElement | null = document.getElementById('itinerary-list');

export function renderSidebar(): void {
  if (!itineraryList) {
    console.error("Sidebar container 'itinerary-list' not found!");
    return;
  }

  const savedScrollTop = itineraryList.scrollTop;
  itineraryList.innerHTML = '';

  // 🧭 เพิ่มปุ่ม Itinerary (overview mode)
  const overviewBtn = document.getElementById('overview-btn');
  if (overviewBtn) {
    overviewBtn.onclick = () => {
      console.log('[SIDEBAR] Overview button clicked → showing all days');
      setActiveDayIndex(null);
      (appState as any).lastFocusedDayIndex = null; // reset focus
      handleAppRender();
    };
  }

  // --- Render days ---
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
        (appState as any).lastFocusedDayIndex = idx; // remember last focus
        handleAppRender();
        handleScrollToDay(idx);
      });

      itineraryList.appendChild(li);
    });
  }

  itineraryList.scrollTop = savedScrollTop;
}

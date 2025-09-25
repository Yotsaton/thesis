//src/components/Sidebar.ts
import { appState, setActiveDayIndex } from '../state/index.js';
import { formatDayLabel } from '../helpers/utils.js';
import { handleAppRender, handleScrollToDay } from '../pages/planner/index.js';
import type { Day } from '../state/index.js'; // ⬅️ 1. Import Type เข้ามา

// TypeScript รู้ว่า getElementById อาจคืนค่า null ได้
const itineraryList: HTMLElement | null = document.getElementById('itinerary-list');

export function renderSidebar(): void {
  // 2. ตรวจสอบให้แน่ใจว่า itineraryList ไม่ใช่ null ก่อนใช้งาน
  if (!itineraryList) {
    console.error("Sidebar container 'itinerary-list' not found!");
    return;
  }
  
  const savedScrollTop = itineraryList.scrollTop;
  itineraryList.innerHTML = '';

  if (appState.currentTrip && appState.currentTrip.days) {
    // 3. กำหนด Type ให้กับ day และ idx ใน loop
    appState.currentTrip.days.forEach((day: Day, idx: number) => {
      const li = document.createElement('li');
      li.textContent = formatDayLabel(day.date);
      
      // 4. แปลง idx ให้เป็น string ก่อนใส่ใน dataset
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
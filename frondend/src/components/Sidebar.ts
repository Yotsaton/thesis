import { appState, setActiveDayIndex } from '../state/index.js';
import { formatDayLabel } from '../helpers/utils.js';
// ⬇️ 1. เพิ่ม import 2 ฟังก์ชันนี้เข้ามา ⬇️
import { handleAppRender, handleScrollToDay } from '../pages/planner/index.js';

const itineraryList = document.getElementById('itinerary-list');

export function renderSidebar() {
  if (!itineraryList) return;
  const savedScrollTop = itineraryList.scrollTop;
  itineraryList.innerHTML = '';

  if (appState.currentTrip && appState.currentTrip.days) {
    appState.currentTrip.days.forEach((day, idx) => {
      const li = document.createElement('li');
      li.textContent = formatDayLabel(day.date);
      li.dataset.idx = idx;
      if (idx === appState.activeDayIndex) {
        li.classList.add('active');
      }
      
      // ⬇️ 2. แก้ไข Event Listener ตรงนี้ ⬇️
      li.addEventListener('click', () => {
        // อัปเดต State
        setActiveDayIndex(idx);
        
        // สั่งวาด UI ใหม่ (เพื่อให้ li ที่คลิกมี class 'active')
        handleAppRender();
        
        // สั่งให้หน้าจอเลื่อนไปที่วันนั้นๆ
        handleScrollToDay(idx);
      });

      itineraryList.appendChild(li);
    });
  }
  itineraryList.scrollTop = savedScrollTop;
}
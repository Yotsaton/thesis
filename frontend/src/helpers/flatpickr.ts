import { appState, updateTripDays } from '../state/index.js';
import { TRIP_COLORS } from './utils.js';
import { handleAppRender } from '../pages/planner/index.js'; // ⬅️ 1. เพิ่ม import นี้เข้ามา

export function initFlatpickr() {
  const datePickerInput = document.getElementById('date-range-picker');
  const addDateBtn = document.getElementById('add-date-btn');
  if (!datePickerInput || !addDateBtn) return;

  const fpInstance = flatpickr(datePickerInput, {
    mode: "range",
    dateFormat: "Y-m-d",
    onClose: function(selectedDates) {
      if (selectedDates.length === 2) {
        const start = selectedDates[0];
        const end = selectedDates[1];
        const newDays = [];
        const oldDaysMap = new Map((appState.currentTrip.days || []).map(day => [day.date, day]));
        let colorIndex = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const isoDate = d.toISOString().split('T')[0];
          const existingDay = oldDaysMap.get(isoDate);
          const color = TRIP_COLORS[colorIndex % TRIP_COLORS.length];
          if (existingDay) {
            newDays.push({ ...existingDay, color });
          } else {
            newDays.push({ date: isoDate, subheading: '', items: [], color });
          }
          colorIndex++;
        }
        // อัปเดตข้อมูล State
        updateTripDays(newDays);
        
        // ⬅️ 2. สั่งให้ UI วาดหน้าจอใหม่
        handleAppRender(); 
      }
    }
  });

  addDateBtn.addEventListener('click', () => {
    fpInstance.open();
  });
}
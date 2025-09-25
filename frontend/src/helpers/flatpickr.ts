import { appState, updateTripDays } from '../state/index.js';
import { TRIP_COLORS } from './utils.js';
import { handleAppRender } from '../pages/planner/index.js';
import type { Day } from '../state/index.js';

// --- Type Definitions ---
// สร้าง Type สำหรับ instance ของ Flatpickr เพื่อให้ TypeScript รู้จักเมธอด .open()
interface FlatpickrInstance {
  open(): void;
}

// บอก TypeScript ให้รู้จักฟังก์ชัน flatpickr ที่มาจาก script ภายนอก
declare function flatpickr(
  element: HTMLElement,
  options: object
): FlatpickrInstance;


// --- Main Function ---
export function initFlatpickr(): void {
  const datePickerInput = document.getElementById('date-range-picker') as HTMLInputElement | null;
  const addDateBtn = document.getElementById('add-date-btn') as HTMLButtonElement | null;
  
  if (!datePickerInput || !addDateBtn) {
    return;
  }

  const fpInstance: FlatpickrInstance = flatpickr(datePickerInput, {
    mode: "range",
    dateFormat: "Y-m-d",
    onClose: function(selectedDates: Date[]) { // กำหนด Type ของ selectedDates
      if (selectedDates.length === 2) {
        const start: Date = selectedDates[0];
        const end: Date = selectedDates[1];
        
        const newDays: Day[] = [];
        const oldDaysMap = new Map<string, Day>(
          (appState.currentTrip.days || []).map(day => [day.date, day])
        );
        
        let colorIndex = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const isoDate = d.toISOString().split('T')[0];
          const existingDay = oldDaysMap.get(isoDate);
          const color = TRIP_COLORS[colorIndex % TRIP_COLORS.length];
          
          if (existingDay) {
            newDays.push({ ...existingDay, color });
          } else {
            // สร้าง object Day ใหม่ที่ตรงตาม interface Day
            const newDay: Day = { date: isoDate, subheading: '', items: [], color };
            newDays.push(newDay);
          }
          colorIndex++;
        }
        
        updateTripDays(newDays);
        handleAppRender(); 
      }
    }
  });

  addDateBtn.addEventListener('click', () => {
    fpInstance.open();
  });
}
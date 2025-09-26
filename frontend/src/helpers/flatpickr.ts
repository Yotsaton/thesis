//src/helpers/flatpickr.ts
import { appState, updateTripDays } from '../state/index.js';
import { TRIP_COLORS } from './utils.js';
import { handleAppRender } from '../pages/planner/index.js';
import type { Day } from '../types.js';

// --- Type Definitions ---
interface FlatpickrInstance {
  open(): void;
}

declare function flatpickr(
  element: HTMLElement,
  options: object
): FlatpickrInstance;


// --- Helper function ---
function toLocalISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


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
    onClose: function(selectedDates: Date[]) {
      if (selectedDates.length === 2) {
        const start: Date = selectedDates[0];
        const end: Date = selectedDates[1];
        
        const newDays: Day[] = [];
        const oldDaysMap = new Map<string, Day>(
          (appState.currentTrip.days || []).map(day => [day.date, day])
        );
        
        let colorIndex = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const isoDate = toLocalISOString(d);
          const existingDay = oldDaysMap.get(isoDate);
          const color = TRIP_COLORS[colorIndex % TRIP_COLORS.length];
          
          if (existingDay) {
            newDays.push({ ...existingDay, color });
          } else {
            const newDay: Day = { 
                id: null,
                date: isoDate, 
                subheading: '', 
                items: [], 
                color: color 
            };
            newDays.push(newDay);
          }
          colorIndex++;
        }
        
        // 🔽 เพิ่ม 2 บรรทัดนี้เพื่ออัปเดต State หลักของทริป 🔽
        appState.currentTrip.start_plan = toLocalISOString(start);
        appState.currentTrip.end_plan = toLocalISOString(end);

        updateTripDays(newDays);
        handleAppRender(); 
      }
    }
  });

  addDateBtn.addEventListener('click', () => {
    fpInstance.open();
  });
}
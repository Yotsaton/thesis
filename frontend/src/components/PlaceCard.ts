//src/components/PlaceCard.ts
import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js';
import { handleAppRender } from '../pages/planner/index.js';
import { escapeHtml, debounce } from '../helpers/utils.js';
import type { PlaceItem } from '../state/index.js'; // ⬅️ 1. Import Type เข้ามา

const debouncedSaveAndRender = debounce(async () => {
  try {
    const tripService = await getTripService();
    await tripService.saveCurrentTrip();
    handleAppRender();
  } catch (error) {
    console.error("Failed to save and render after debounce:", error);
  }
}, 800);

// 2. กำหนด Type ให้กับพารามิเตอร์
export function createPlaceCardElement(
  place: PlaceItem,
  itemIndex: number,
  dayIndex: number,
  dayColor: string,
  isFirst: boolean,
  isLast: boolean
): HTMLDivElement {
  const placeCard = document.createElement('div');
  placeCard.className = 'place-box';
  placeCard.style.borderLeft = `5px solid ${dayColor || '#ccc'}`;

  let positionLabel = '';
  if (isFirst) {
    positionLabel = `<span class="position-label start-label"><i class='bx bxs-flag-alt'></i> Start Point</span>`;
  } else if (isLast) {
    positionLabel = `<span class="position-label end-label"><i class='bx bxs-flag-checkered'></i> End Point</span>`;
  }

  placeCard.innerHTML = `
    <div class="place-card-content">
      <div class="place-header">
        <strong class="kv">${escapeHtml(place.name)}</strong>
        ${positionLabel}
        <button class="del-place-btn" title="Delete Item"><i class='bx bx-x'></i></button>
      </div>
      <div class="place-times">
        <input type="time" class="start-time" value="${place.startTime || ''}" />
        <span>–</span>
        <input type="time" class="end-time" value="${place.endTime || ''}" />
      </div>
    </div>
    <div class="travel-info" id="travel-info-${dayIndex}-${itemIndex}"></div>
  `;

  // 3. ตรวจสอบ Element ก่อนใช้งาน
  const deleteButton = placeCard.querySelector<HTMLButtonElement>('.del-place-btn');
  if (deleteButton) {
    deleteButton.addEventListener('click', async () => {
      // ตรวจสอบให้แน่ใจว่า currentTrip และ days มีอยู่จริง
      if (appState.currentTrip?.days?.[dayIndex]?.items) {
        appState.currentTrip.days[dayIndex].items.splice(itemIndex, 1);
        const tripService = await getTripService();
        await tripService.saveCurrentTrip();
        handleAppRender();
      }
    });
  }

  const startTimeInput = placeCard.querySelector<HTMLInputElement>('.start-time');
  if (startTimeInput) {
    startTimeInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (appState.currentTrip?.days?.[dayIndex]?.items?.[itemIndex]) {
        // TypeScript ช่วยให้เรารู้ว่า item อาจเป็น NoteItem ได้ เราจึงต้องเช็ค type ก่อน
        const item = appState.currentTrip.days[dayIndex].items[itemIndex];
        if (item.type === 'place') {
          item.startTime = target.value;
          debouncedSaveAndRender();
        }
      }
    });
  }

  const endTimeInput = placeCard.querySelector<HTMLInputElement>('.end-time');
  if (endTimeInput) {
    endTimeInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (appState.currentTrip?.days?.[dayIndex]?.items?.[itemIndex]) {
        const item = appState.currentTrip.days[dayIndex].items[itemIndex];
        if (item.type === 'place') {
          item.endTime = target.value;
          debouncedSaveAndRender();
        }
      }
    });
  }
  
  return placeCard;
}
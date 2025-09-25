import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js'; // ⬅️ (แก้ไข) เปลี่ยน import
import { handleAppRender } from '../pages/planner/index.js';
import { escapeHtml, debounce } from '../helpers/utils.js';

// ⬇️ (แก้ไข) ปรับปรุงฟังก์ชัน debounce ให้เป็น async ⬇️
const debouncedSaveAndRender = debounce(async () => {
  try {
    const tripService = await getTripService();
    await tripService.saveCurrentTrip();
    handleAppRender();
  } catch (error) {
    console.error("Failed to save and render after debounce:", error);
  }
}, 800);

export function createPlaceCardElement(place, itemIndex, dayIndex, dayColor, isFirst, isLast) {
  const placeCard = document.createElement('div');
  placeCard.className = 'place-box';
  placeCard.style.borderLeft = `5px solid ${dayColor || '#ccc'}`;

  // สร้าง tag สำหรับ label เริ่มต้น/สิ้นสุด
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
        ${positionLabel} <button class="del-place-btn" title="Delete Item"><i class='bx bx-x'></i></button>
      </div>
      <div class="place-times">
        <input type="time" class="start-time" value="${place.startTime || ''}" />
        <span>–</span>
        <input type="time" class="end-time" value="${place.endTime || ''}" />
      </div>
    </div>
    <div class="travel-info" id="travel-info-${dayIndex}-${itemIndex}"></div>
  `;

  // ⬇️ (แก้ไข) ทำให้ event listener เป็น async ⬇️
  const deleteButton = placeCard.querySelector('.del-place-btn');
  deleteButton.addEventListener('click', async () => {
    appState.currentTrip.days[dayIndex].items.splice(itemIndex, 1);
    const tripService = await getTripService();
    await tripService.saveCurrentTrip();
    handleAppRender();
  });

  const startTimeInput = placeCard.querySelector('.start-time');
  startTimeInput.addEventListener('change', (e) => {
    appState.currentTrip.days[dayIndex].items[itemIndex].startTime = e.target.value;
    debouncedSaveAndRender();
  });

  const endTimeInput = placeCard.querySelector('.end-time');
  endTimeInput.addEventListener('change', (e) => {
    appState.currentTrip.days[dayIndex].items[itemIndex].endTime = e.target.value;
    debouncedSaveAndRender();
  });
  
  return placeCard;
}
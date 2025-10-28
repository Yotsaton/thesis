import { appState, triggerAutoSave } from '../state/index.js';
import { handleAppRender } from '../pages/planner/index.js';
import { escapeHtml, debounce } from '../helpers/utils.js';
import { getPlaceNumbering } from '../helpers/placeNumbering.js';
import type { PlaceItem } from '../types.js';

declare var flatpickr: any;

// ✅ ใช้ autosave system แทน tripService
const debouncedAutoSaveAndRender = debounce(() => {
  triggerAutoSave(600);
  handleAppRender();
}, 800);

export function createPlaceCardElement(
  place: PlaceItem,
  itemIndex: number,
  dayIndex: number,
  dayColor: string,
  isFirst: boolean,
  isLast: boolean
): HTMLDivElement {
  const numberingMap = getPlaceNumbering();
  const placeKey = `${dayIndex}-${itemIndex}`;
  const placeInfo = numberingMap[placeKey];
  const displayNumber = placeInfo?.number ?? null;
  const numberColor = placeInfo?.color ?? dayColor ?? '#4a6cf7';

  const placeCard = document.createElement('div');
  placeCard.className = 'place-box';
  placeCard.style.borderLeft = `5px solid ${numberColor}`;

  let positionLabel = '';
  if (isFirst) {
    positionLabel = `<span class="position-label start-label"><i class='bx bxs-flag-alt'></i> Start Point</span>`;
  } else if (isLast) {
    positionLabel = `<span class="position-label end-label"><i class='bx bxs-flag-checkered'></i> End Point</span>`;
  }

  const numberBadge = displayNumber
    ? `<span class="place-number" style="background:${numberColor}">${displayNumber}</span>`
    : '';

  placeCard.innerHTML = `
    <div class="place-card-content">
      <div class="place-header">
        <div class="left-group">
          ${numberBadge}
          <strong class="kv">${escapeHtml(place.name)}</strong>
        </div>
        <div class="right-group">
          ${positionLabel}
          <button class="del-place-btn" title="Delete Item"><i class='bx bx-x'></i></button>
        </div>
      </div>
      <div class="place-times">
        <input type="text" class="start-time flatpickr-time-input" placeholder="--:--" value="${place.startTime || ''}" />
        <span>–</span>
        <input type="text" class="end-time flatpickr-time-input" placeholder="--:--" value="${place.endTime || ''}" />
      </div>
    </div>
    <div class="travel-info" id="travel-info-${dayIndex}-${itemIndex}"></div>
  `;

  // ✅ ปุ่มลบ
  const deleteButton = placeCard.querySelector<HTMLButtonElement>('.del-place-btn');
  if (deleteButton) {
    deleteButton.addEventListener('click', () => {
      if (appState.currentTrip?.days?.[dayIndex]?.items) {
        appState.currentTrip.days[dayIndex].items.splice(itemIndex, 1);
        triggerAutoSave(800);
        handleAppRender();
      }
    });
  }

  // ✅ ตั้งค่า time picker
  const timePickerOptions = {
    enableTime: true,
    noCalendar: true,
    dateFormat: 'H:i',
    time_24hr: true,
  };

  const startTimeInput = placeCard.querySelector<HTMLInputElement>('.start-time');
  if (startTimeInput) {
    flatpickr(startTimeInput, {
      ...timePickerOptions,
      onChange: function (_selectedDates: Date[], dateStr: string) {
        const item = appState.currentTrip?.days?.[dayIndex]?.items?.[itemIndex];
        if (item && item.type === 'place') {
          item.startTime = dateStr;
          debouncedAutoSaveAndRender();
        }
      },
    });
  }

  const endTimeInput = placeCard.querySelector<HTMLInputElement>('.end-time');
  if (endTimeInput) {
    flatpickr(endTimeInput, {
      ...timePickerOptions,
      onChange: function (_selectedDates: Date[], dateStr: string) {
        const item = appState.currentTrip?.days?.[dayIndex]?.items?.[itemIndex];
        if (item && item.type === 'place') {
          item.endTime = dateStr;
          debouncedAutoSaveAndRender();
        }
      },
    });
  }

  return placeCard;
}

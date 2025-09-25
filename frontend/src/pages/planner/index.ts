import { appState, setActiveDayIndex, createNewLocalTrip, updateCurrentTripName, addPlaceToDay } from '../../state/index.js';
import { getTripService } from '../../services/config.js';
import { renderSidebar } from '../../components/Sidebar.js';
import { renderItinerary } from '../../components/Itinerary.js';
import { initMap, renderMapMarkersAndRoute } from '../../components/Map.js';
import { initFlatpickr } from '../../helpers/flatpickr.js';
import { prettyDate } from '../../helpers/utils.js';
import type { Day } from '../../state/index.js';

// --- Save Status Functionality ---
let statusTimeout: number;

function updateSaveStatus(message: string, isError: boolean = false): void {
  const statusEl = document.getElementById('save-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ffadad' : '#d8f1d8';
  
  window.clearTimeout(statusTimeout);
  if (message) {
    statusTimeout = window.setTimeout(() => {
      if(statusEl) statusEl.textContent = '';
    }, 3000);
  }
}

// --- UI Rendering & Control Functions ---
export function handleAppRender(): void {
  renderSidebar();
  renderItinerary();
  handleMapRender();
  updateTripNameInput(appState.currentTrip.name);
}

export function handleMapRender(): void {
  renderMapMarkersAndRoute();
}

export function handleSidebarRender(): void {
  renderSidebar();
}

export function updateTripNameInput(newName: string): void {
  const tripNameInput = document.getElementById('trip-name-input') as HTMLInputElement | null;
  if (tripNameInput) {
    tripNameInput.value = newName;
  }
}

export function handleScrollToDay(index: number): void {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  
  setTimeout(() => {
    const daySection = document.getElementById(`day-section-${index}`);
    if (daySection) {
      mainContent.scrollTo({ top: daySection.offsetTop - 30, behavior: 'smooth' });
    }
  }, 50);
}

export function isTripPopulated(): boolean {
  return appState.currentTrip?.days?.length > 0;
}

export function showDaySelectionPopup(name: string, lat: number, lng: number, place_id: string = ''): void {
  const daySelectionPopup = document.getElementById('day-selection-popup');
  const dayList = document.getElementById('day-list-for-selection');
  const cancelBtn = document.getElementById('day-selection-cancel-btn');

  if (!daySelectionPopup || !dayList || !cancelBtn) return;
  
  dayList.innerHTML = '';
  if (appState.currentTrip?.days) {
    appState.currentTrip.days.forEach((day: Day, index: number) => {
      const li = document.createElement('li');
      li.textContent = prettyDate(day.date);
      li.onclick = () => {
        addPlaceToDay(index, name, lat, lng, place_id);
        handleAppRender();
        daySelectionPopup.style.display = 'none';
      };
      dayList.appendChild(li);
    });
  }
  
  daySelectionPopup.style.display = 'flex';
  cancelBtn.onclick = () => {
    if (daySelectionPopup) daySelectionPopup.style.display = 'none';
  };
}

// --- Main App Initialization Logic ---
async function wireEvents(): Promise<void> {
  const tripService = await getTripService();

  const logoutBtn = document.querySelector<HTMLButtonElement>('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('activeTripId');
      window.location.href = '/main.html';
    });
  }

  const tripNameInput = document.getElementById('trip-name-input') as HTMLInputElement | null;
  if (tripNameInput) {
    tripNameInput.addEventListener('change', async (e: Event) => {
      const target = e.target as HTMLInputElement;
      updateCurrentTripName(target.value);
      updateSaveStatus('Saving...');
      await tripService.saveCurrentTrip();
      updateSaveStatus('All changes saved ✅');
    });
  }

  const newBtn = document.getElementById('new-plan-btn');
  if (newBtn) {
    newBtn.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      if (confirm('Create a new blank plan?')) {
        localStorage.removeItem('activeTripId');
        createNewLocalTrip();
        handleAppRender();
      }
    });
  }
  
  const saveBtn = document.getElementById('save-plan-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e: MouseEvent) => {
      e.preventDefault();
      updateSaveStatus('Saving...');
      await tripService.saveCurrentTrip();
      updateSaveStatus('All changes saved ✅');
    });
  }

  const recommendBtn = document.getElementById('recommend-btn');
  if (recommendBtn) {
    recommendBtn.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      const modal = document.getElementById('recommend-modal');
      if (modal) {
        modal.classList.add('active');
      }
    });
  }
}

async function initializeApp(): Promise<void> {
  await wireEvents();
  await initMap();

  const tripService = await getTripService();
  const activeTripId = localStorage.getItem('activeTripId');
  if (activeTripId) {
    await tripService.loadTrip(activeTripId);
  } else {
    createNewLocalTrip();
  }

  initFlatpickr();
  handleAppRender();
}

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});
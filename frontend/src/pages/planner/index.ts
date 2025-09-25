import { appState, setActiveDayIndex, createNewLocalTrip, updateCurrentTripName, addPlaceToDay } from '../../state/index.js';
import { getTripService } from '../../services/config.js';
import { renderSidebar } from '../../components/Sidebar.js';
import { renderItinerary } from '../../components/Itinerary.js';
import { initMap, renderMapMarkersAndRoute } from '../../components/Map.js';
import { initFlatpickr } from '../../helpers/flatpickr.js';
import { prettyDate } from '../../helpers/utils.js';

// ⬇️ 1. เพิ่มฟังก์ชันจัดการสถานะเข้ามาตรงนี้ ⬇️
let statusTimeout;
function updateSaveStatus(message, isError = false) {
  const statusEl = document.getElementById('save-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ffadad' : '#d8f1d8';
  
  clearTimeout(statusTimeout);
  if (message) {
    statusTimeout = setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
  }
}

export function handleAppRender() {
  renderSidebar();
  renderItinerary();
  handleMapRender();
  updateTripNameInput(appState.currentTrip.name);
}

export function handleMapRender() {
  renderMapMarkersAndRoute();
}

export function handleSidebarRender() {
  renderSidebar();
}

export function updateTripNameInput(newName) {
  const tripNameInput = document.getElementById('trip-name-input');
  if (tripNameInput) tripNameInput.value = newName;
}

export function handleScrollToDay(index) {
  if (index === null) return;
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  setTimeout(() => {
    const daySection = document.getElementById(`day-section-${index}`);
    if (daySection) {
      mainContent.scrollTo({ top: daySection.offsetTop - 30, behavior: 'smooth' });
    }
  }, 50);
}

export function isTripPopulated() {
  return appState.currentTrip && appState.currentTrip.days.length > 0;
}

export function showDaySelectionPopup(name, lat, lng, place_id = '') {
  const daySelectionPopup = document.getElementById('day-selection-popup');
  const dayList = document.getElementById('day-list-for-selection');
  const cancelBtn = document.getElementById('day-selection-cancel-btn');
  dayList.innerHTML = '';
  if (appState.currentTrip && appState.currentTrip.days) {
    appState.currentTrip.days.forEach((day, index) => {
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
  cancelBtn.onclick = () => (daySelectionPopup.style.display = 'none');
}

async function wireEvents() {
  const tripService = await getTripService();

  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('activeTripId');
      window.location.href = '/public/main.html';
    });
  }

  const tripNameInput = document.getElementById('trip-name-input');
  if (tripNameInput) {
    tripNameInput.addEventListener('change', async (e) => {
      updateCurrentTripName(e.target.value);
      updateSaveStatus('Saving...');
      await tripService.saveCurrentTrip();
      updateSaveStatus('All changes saved ✅');
    });
  }

  const newBtn = document.getElementById('new-plan-btn');
  if (newBtn) {
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Create a new blank plan?')) {
        localStorage.removeItem('activeTripId');
        createNewLocalTrip();
        handleAppRender();
      }
    });
  }

  // ⬇️ 2. แก้ไข Event Listener ของปุ่ม Save ⬇️
  const saveBtn = document.getElementById('save-plan-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      updateSaveStatus('Saving...');
      await tripService.saveCurrentTrip();
      updateSaveStatus('All changes saved ✅');
    });
  }

  const recommendBtn = document.getElementById('recommend-btn');
  if (recommendBtn) {
    recommendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = document.getElementById('recommend-modal');
      if (modal) {
        modal.classList.add('active');
      }
    });
  }
}

async function initializeApp() {
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
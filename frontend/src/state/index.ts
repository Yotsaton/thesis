import { getTripService } from '../services/config.js';
import type { Trip, Day, PlaceItem, AppState } from '../types.js';

// --- Global App State ---
export const appState: AppState = {
  trips: [],
  currentTripId: null,
  currentTrip: {
    id: null,
    name: 'Untitled Plan',
    days: []
  },
  activeDayIndex: null,
};

// --- Internal Save Function (Direct API call, no debounce) ---
let saveInProgress = false;
let pendingSave = false;

async function saveCurrentTripDirect(): Promise<void> {
  if (saveInProgress) {
    console.log('[STATE] Save already in progress → queued for retry');
    pendingSave = true;
    return;
  }

  try {
    saveInProgress = true;
    const tripService = await getTripService();
    console.log('[STATE] Triggering saveCurrentTripDirect()');
    await tripService.saveCurrentTrip();
  } catch (error) {
    console.error('[STATE] Failed to save trip:', error);
  } finally {
    saveInProgress = false;

    // ✅ ถ้ามี save ที่รอไว้จากการซ้ำ ให้ retry หลังจาก delay สั้น ๆ
    if (pendingSave) {
      pendingSave = false;
      console.log('[STATE] Retrying queued save...');
      setTimeout(() => saveCurrentTripDirect(), 400);
    }
  }
}

// --- 🧠 Global Debounce Auto-Save System ---
let autosaveTimer: number | null = null;
export function triggerAutoSave(delay: number = 1200): void {
  if (autosaveTimer) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(async () => {
    console.log('[AUTO-SAVE] Triggered at', new Date().toLocaleTimeString());
    await saveCurrentTripDirect();
  }, delay);
}

// --- State Management Functions ---
export function setTripList(trips: Trip[]): void {
  appState.trips = trips;
}

export function setCurrentTrip(tripData: Trip): void {
  appState.currentTripId = tripData.id || null;
  // ✅ merge เพื่อป้องกัน overwriting state ขณะ save
  appState.currentTrip = { ...appState.currentTrip, ...tripData };
  appState.activeDayIndex = null;
}

export function createNewLocalTrip(): void {
  appState.currentTripId = null;
  appState.currentTrip = { id: null, name: 'Untitled Plan', days: [] };
  appState.activeDayIndex = null;
}

export function updateCurrentTripName(newName: string): void {
  if (appState.currentTrip) {
    appState.currentTrip.name = newName;
    triggerAutoSave(1000); // 🔁 บันทึกอัตโนมัติเมื่อแก้ชื่อแผน
  }
}

export function setActiveDayIndex(index: number | null): void {
  if (appState.activeDayIndex === index) return;
  appState.activeDayIndex = index;
}

export function updateTripDays(newDays: Day[]): void {
  if (appState.currentTrip) {
    appState.currentTrip.days = newDays;
  }
  triggerAutoSave(1200); // 🔁 autosave ทุกครั้งที่วันเปลี่ยน
}

// --- ✅ เพิ่มสถานที่ในแต่ละวัน พร้อม autosave ---
export async function addPlaceToDay(
  dayIndex: number,
  name: string,
  lat: number,
  lng: number,
  place_id: string = ''
): Promise<void> {
  const trip = appState.currentTrip;
  if (!trip || !trip.days[dayIndex]) return;

  const day: Day = trip.days[dayIndex];

  // ตรวจสอบและสร้าง array items ถ้ายังไม่มี
  if (!day.items) day.items = [];

  // ✅ ใช้ Type ที่ถูกต้องจาก PlaceItem
  const newPlace: PlaceItem = {
    id: null,
    type: 'place',
    name: name || 'Pinned location',
    place_id: place_id || '',
    location: { type: 'Point', coordinates: [lng, lat] },
    startTime: '',
    endTime: ''
  };

  day.items.push(newPlace);

  // ✅ เก็บค่า focus เดิมไว้ก่อน save
  const prevFocus = appState.activeDayIndex;
  appState.activeDayIndex = dayIndex;

  try {
    triggerAutoSave(800); // 🔁 autosave หลังเพิ่มสถานที่
  } catch (err) {
    console.warn('[STATE] Trip save failed temporarily:', err);
  }

  // ✅ Restore focus หลัง save (ป้องกัน overview mode)
  appState.activeDayIndex = prevFocus ?? dayIndex;
}

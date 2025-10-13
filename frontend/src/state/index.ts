// src/state/index.js
import { getTripService } from '../services/config.js';
import { renderMapMarkersAndRoute } from '../components/Map.js'; // ✅ เพิ่มการ import เพื่อ refresh map
import type { Trip, Day, PlaceItem, AppState } from '../types.js';

// --- กำหนด Type ให้กับ appState object ---
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

// --- Helper Function ---
async function saveCurrentTrip(): Promise<void> {
  try {
    const tripService = await getTripService();
    await tripService.saveCurrentTrip();
  } catch (error) {
    console.error('Failed to save trip:', error);
  }
}

// --- การจัดการ State หลัก ---
export function setTripList(trips: Trip[]): void {
  appState.trips = trips;
}

export function setCurrentTrip(tripData: Trip): void {
  appState.currentTripId = tripData.id || null;
  appState.currentTrip = tripData;
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
  // setActiveDayIndex(null);
  saveCurrentTrip();
}

// --- ✅ เพิ่มสถานที่ในแต่ละวัน พร้อม refresh map ---
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
  if (!day.items) {
    day.items = [];
  }

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
    await saveCurrentTrip();
  } catch (err) {
    console.warn('Trip save failed temporarily:', err);
  }

  // ✅ Restore focus หลัง save (ป้องกัน overview mode)
  appState.activeDayIndex = prevFocus ?? dayIndex;
}

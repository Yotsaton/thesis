// state/index.ts
import { getTripService } from '../services/config.js';
// 🔽 1. ลบ interface เดิมออก แล้ว import Type ทั้งหมดมาจากที่ใหม่ 🔽
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

// Helper function (internal to this module)
async function saveCurrentTrip(): Promise<void> {
    try {
        const tripService = await getTripService();
        await tripService.saveCurrentTrip();
    } catch (error) {
        console.error("Failed to save trip:", error);
    }
}

// --- ฟังก์ชันทั้งหมดตอนนี้จะใช้ Type ที่ import เข้ามา ---
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
  setActiveDayIndex(null);
  saveCurrentTrip();
}

export function addPlaceToDay(
  dayIndex: number,
  name: string,
  lat: number,
  lng: number,
  place_id: string = ''
): void {
  const day = appState.currentTrip?.days[dayIndex];
  if (!day) return;
  
  if (!day.items) {
    day.items = [];
  }

  // 🔽 2. แก้ไข newPlace ให้ใช้ interface ที่ถูกต้อง และรูปแบบ GeoJSON ใหม่ 🔽
  const newPlace: PlaceItem = {
    type: 'place',
    id: 'p_' + Date.now(),
    name: name || 'Pinned location',
    place_id: place_id || '',
    location: { type: 'Point', coordinates: [lng, lat] }, // [longitude, latitude]
    startTime: '',
    endTime: ''
  };

  appState.activeDayIndex = dayIndex;
  day.items.push(newPlace);
  saveCurrentTrip();
}
//src/state/index.js

import { getTripService } from '../services/config.js';

// --- สร้าง "พิมพ์เขียว" (Interfaces & Types) สำหรับโครงสร้างข้อมูลทั้งหมด ---
// สามารถย้าย Type เหล่านี้ไปไว้ในไฟล์กลาง src/types.ts ในอนาคตได้

// interface support
export interface geoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export type DateYMD = string; // 'YYYY-MM-DD'
export type Time = string; // 'HH:mmZ'


export type DayItem = {
  id: string | null;
  place_id?: string; // id from database
  location?: geoJSONPoint; // lng, lat
  name?: string;
  text?: string;
  startTime?: Time;
  endTime?: Time;
}

export interface Day {
  id: string | null;
  date: DateYMD;
  subheading: string;
  items: DayItem[];
  updatedAt?: string;
  color: string;
}

export interface Trip {
  id: string | null;
  name: string;
  start_plan?: string;
  end_plan?: string;
  days: Day[];
  updatedAt?: string;
}

export interface AppState {
  trips: Trip[];
  currentTripId: string | null;
  currentTrip: Trip;
  activeDayIndex: number | null;
}

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

// --- กำหนด Type ให้กับพารามิเตอร์ของฟังก์ชันทั้งหมด ---
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
  lat: number | string,
  lng: number | string,
  place_id: string = ''
): void {
  const day = appState.currentTrip?.days[dayIndex];
  if (!day) return;
  
  if (!day.items) {
    day.items = [];
  }

  const newPlace: DayItem = {
    id: 'p_' + Date.now(),
    name: name || 'Pinned location',
    place_id: place_id || '',
    location: { coordinates: [parseFloat(lng as string), parseFloat(lat as string)], type: 'Point' },
    startTime: '',
    endTime: ''
  };

  appState.activeDayIndex = dayIndex;
  day.items.push(newPlace);
  saveCurrentTrip();
}
//src/state/index.js

import { getTripService } from '../services/config.js';

// --- สร้าง "พิมพ์เขียว" (Interfaces & Types) สำหรับโครงสร้างข้อมูลทั้งหมด ---
// สามารถย้าย Type เหล่านี้ไปไว้ในไฟล์กลาง src/types.ts ในอนาคตได้
export interface geoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export type DateYMD = string; // 'YYYY-MM-DD'

export interface PlaceItem {
  type: 'place';
  id: string;
  name: string;
  place_id: string;
  location: { lat: number; lng: number };
  startTime: string;
  endTime: string;
}

export interface NoteItem {
  type: 'note';
  id: string;
  text: string;
}

export type DayItem = PlaceItem | NoteItem;

export interface Day {
  date: string;
  subheading: string;
  items: DayItem[];
  color: string;
}

export interface Trip {
  _id: string | null;
  name: string;
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
    _id: null,
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
  appState.currentTripId = tripData._id || null;
  appState.currentTrip = tripData;
  appState.activeDayIndex = null;
}

export function createNewLocalTrip(): void {
  appState.currentTripId = null;
  appState.currentTrip = { _id: null, name: 'Untitled Plan', days: [] };
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

  const newPlace: PlaceItem = {
    type: 'place',
    id: 'p_' + Date.now(),
    name: name || 'Pinned location',
    place_id: place_id || '',
    location: { lat: parseFloat(lat as string), lng: parseFloat(lng as string) },
    startTime: '',
    endTime: ''
  };

  appState.activeDayIndex = dayIndex;
  day.items.push(newPlace);
  saveCurrentTrip();
}
// src/types.ts

// --- Base Types ---
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}
export type DateYMD = string; // 'YYYY-MM-DD'
export type Time = string; // 'HH:mm'

// --- Item Types (แยกประเภทชัดเจน) ---
export interface PlaceItem {
  type: 'place';
  id: string | null;
  place_id?: string;
  location?: GeoJSONPoint;
  name?: string;
  startTime?: Time;
  endTime?: Time;
}

export interface NoteItem {
  type: 'note';
  id: string | null;
  text?: string;
}

export type DayItem = PlaceItem | NoteItem;

// --- Trip Structure Types ---
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

// --- App State Type ---
export interface AppState {
  trips: Trip[];
  currentTripId: string | null;
  currentTrip: Trip;
  activeDayIndex: number | null;
}

// --- Service Interface ---
export interface TripServiceInterface {
  loadTripList: () => Promise<any>;
  loadTrip: (tripId: string) => Promise<any>;
  saveCurrentTrip: () => Promise<any>;
  deleteTrip: (tripId: string, ifMatchUpdatedAt: string) => Promise<any>;
}
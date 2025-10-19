//src/types.ts
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

export type DateYMD = string;
export type Time = string;

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

export interface Day {
  id: string | null;
  date: DateYMD;
  subheading: string;
  items: DayItem[];
  updatedAt?: string;
  color: string;
  summary?: {
    distance: number;
    duration: number;
  };
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

// --- Service Interface ---
export interface TripServiceInterface {
  loadTripList: () => Promise<any>;
  loadTrip: (tripId: string) => Promise<any>;
  saveCurrentTrip: () => Promise<any>;
  deleteTrip: (tripId: string, ifMatchUpdatedAt: string) => Promise<any>;
}

// ✅ เพิ่ม type สำหรับ cache geometry
export interface CachedRouteGeometry {
  geometry: { coordinates: [number, number][] };
  savedAt: number;
}

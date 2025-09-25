// src/types.ts

// รายการในแต่ละวัน อาจเป็นสถานที่หรือโน้ต
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

// ข้อมูลของแต่ละวัน
export interface Day {
  date: string; // ISO date string e.g., "2025-09-25"
  subheading: string;
  items: DayItem[];
  color: string;
}

// ข้อมูลของทริปทั้งหมด
export interface Trip {
  _id: string | null; // null for a new, unsaved trip
  name: string;
  days: Day[];
  createdAt?: string; // Optional for new local trips
  updatedAt?: string; // Optional for new local trips
}

// Interface สำหรับ Service Module เพื่อให้มีมาตรฐานเดียวกัน
// ทำให้ config.ts รู้จักฟังก์ชันที่จะถูก import เข้ามา
export interface TripServiceInterface {
    loadTripList: () => Promise<any>;
    loadTrip: (tripId: string) => Promise<any>;
    saveCurrentTrip: () => Promise<any>;
    deleteTrip: (tripId: string) => Promise<any>;
}
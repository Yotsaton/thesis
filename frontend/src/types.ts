// src/types.ts



// interface support
export interface geoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export type DateYMD = string; // 'YYYY-MM-DD'
export type Time = string; // 'HH:mm'

// รายการในแต่ละวัน อาจเป็นสถานที่หรือโน้ต
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

// Interface สำหรับ Service Module เพื่อให้มีมาตรฐานเดียวกัน
// ทำให้ config.ts รู้จักฟังก์ชันที่จะถูก import เข้ามา
export interface TripServiceInterface {
    loadTripList: () => Promise<any>;
    loadTrip: (tripId: string) => Promise<any>;
    saveCurrentTrip: () => Promise<any>;
    deleteTrip: (tripId: string) => Promise<any>;
}
// src/trip/types/types.ts

import { DateYMD, geoJSONPoint, Time } from "../../database/database.types";

export type CreateTripParams = {
  username: string;                       // FK -> users.username
  header?: string | null;                 // ชื่อทริป (อนุญาตให้ว่างได้)
  start_plan: string | Date;              // วันเริ่ม (date)
  end_plan: string | Date;                // วันจบ (date)
};


export type ListTripsOptions = {
  // เฉพาะแอดมินเท่านั้นที่ใช้ได้: ระบุผู้ใช้เป้าหมาย
  usernames?: string | string[];        // ฟิลเตอร์ผู้ใช้ (หนึ่ง/หลายคน)

  // ฟิลเตอร์ทั่วไป
  status?: 'active' | 'deleted' | Array<'active' | 'deleted'>;  // <<— จำกัดค่าให้ตรง DB
  from?: string | Date;                 // start_plan >= from
  to?: string | Date;                   // end_plan   <= to
  q?: string;                           // ค้นหา header แบบ ILIKE %q%
  orderBy?: 'start_plan' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  limit?: number;                       // default 50
  offset?: number;                      // default 0
};

export type TripPatch = {
  header?: string | null;
  start_plan?: string | Date;
  end_plan?: string | Date;
  status?: string;
  // อนุญาตให้แอดมินย้ายเจ้าของทริปได้ (ถ้าไม่ต้องการ ลบออกได้)
  username?: string;
};

export type UpdateOptions = {
  /** ใช้ทำ optimistic concurrency: อนุญาตอัปเดตก็ต่อเมื่อ updated_at ตรงกัน */
  ifMatchUpdatedAt?: string | Date;
};

export interface PlaceItem {
  type: 'place';
  id: string | null;
  place_id?: string;
  location?: geoJSONPoint;
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
}

export interface Trip {
  id: string | null;
  name: string;
  start_plan?: DateYMD;
  end_plan?: DateYMD;
  days: Day[];
  updatedAt?: Date;
}

// src/dayTrip/types/type.ts

/** ข้อมูลที่ client ส่งมาเพื่อสร้าง day_trip ใหม่ */
export type CreateDayTripInput = {
  trip_id: string;           // FK -> trip.id
  date: string | Date;       // วันของทริป (date-only)
  header?: string | null;    // ชื่อ/หัวข้อย่อยของวัน
  geometry?: string | null;  // เก็บเส้น/ขอบเขต (text) ถ้ามี
  id?: string;               // ถ้าต้องการกำหนดเอง; ปกติปล่อยให้ gen
};

export type Accessor = {
  username: string;
  is_super_user?: boolean;
  is_staff_user?: boolean;
};

export type ListDayTripsOptions = {
  trip_id?: string;                 // ถ้าระบุจะกรองเฉพาะทริปนั้น
  dateFrom?: string | Date;         // d.date >= dateFrom
  dateTo?: string | Date;           // d.date <= dateTo
  q?: string;                       // ค้นหาใน header (ILIKE)
  orderBy?: "date" | "created_at" | "updated_at";
  order?: "asc" | "desc";
  limit?: number;                   // default 50
  offset?: number;                  // default 0
};

export type DayTripPatch = {
  header?: string | null;
  date?: string | Date;       // เปลี่ยนวันที่ของ day_trip
  geometry?: string | null;
  trip_id?: string;           // ย้ายไปอยู่ทริปอื่น (ดูสิทธิ์ด้านล่าง)
};

export type UpdateOptions = {
  /** อนุญาตอัปเดตก็ต่อเมื่อ updated_at ตรงกับค่าที่ client ถืออยู่ (optimistic locking) */
  ifMatchUpdatedAt?: string | Date;
};
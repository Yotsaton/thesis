// src/activity/types/types.ts
import { activity_log } from "../../database/database.types";

/** รูปแบบข้อมูลสำหรับ insert เข้า activity_log */
export interface ActivityLogInsert {
  username: string;           // ต้องมี (FK ไปที่ public.users.username)
  ip_addr: string;            // IPv4/IPv6 เป็น string เช่น '203.0.113.5' หรือ '2001:db8::1'
  activity?: string | object; // เก็บรายละเอียดเหตุการณ์ เป็น text; ถ้าเป็น object จะ stringify ให้
}

/** เงื่อนไขการค้นหา log */
export interface ActivityLogQuery {
  username?: string;        // กรองตามผู้ใช้ (ignored ถ้าไม่ใช่แอดมิน/สตาฟ)
  ip?: string;              // '1.2.3.4' = exact, ใส่ '%' หรือ '*' เพื่อทำ like/prefix
  activitySearch?: string;  // ILIKE %...% กับคอลัมน์ text
  timeFrom?: Date | string; // created_at >= timeFrom
  timeTo?: Date | string;   // created_at <  timeTo
  limit?: number;           // ดีฟอลต์ 50 (สูงสุด 200)
  cursorId?: number;        // keyset pagination: id < cursorId เมื่อ sort DESC
  sortAsc?: boolean;        // ปกติ false = ใหม่ก่อน (DESC)
}

/** แถวผลลัพธ์ที่คืนไปยัง API */
export interface ActivityLogRow {
  id: number;
  username: string;
  ip_addr: string;       // แปลงเป็น text เพื่อใช้ง่าย
  activity: string;      // เก็บตามจริงใน DB (text)
  activity_json?: any;   // พยายาม parse JSON ถ้าพอได้
  created_at: string;    // ISO string
}

export interface ActivityLogResult {
  items: ActivityLogRow[];
  nextCursorId?: number; // ใช้ต่อหน้า (DESC: เอา id สุดท้ายน้อยสุดของหน้านี้ไปใส่ cursorId)
  hasMore: boolean;
}
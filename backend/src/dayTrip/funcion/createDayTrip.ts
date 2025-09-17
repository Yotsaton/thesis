// src/dayTrip/function/createDayTrip.ts
import crypto from "crypto";
import { db } from "../../database/db-promise";
import type { day_trip, trip } from "../../database/database.types";
import type { CreateDayTripInput, Accessor } from "../types/types";

/** แปลงเป็นสตริง YYYY-MM-DD เพื่อกัน timezone ป่วน */
function toDateOnly(input: string | Date): string {
  if (input instanceof Date) {
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, "0");
    const d = String(input.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return input; // assume 'YYYY-MM-DD'
}

/**
 * สร้าง day_trip ใหม่แบบมีสิทธิ์:
 * - user ธรรมดา: เพิ่มได้เฉพาะทริปที่ตนเป็นเจ้าของ
 * - admin/staff: เพิ่มให้ทริปใดก็ได้
 */
export async function createDayTripAuthorized(
  accessor: Accessor,
  input: CreateDayTripInput
): Promise<day_trip> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);
  const id = input.id ?? crypto.randomUUID();
  const date = toDateOnly(input.date);

  // 1) โหลด trip เพื่อตรวจสิทธิ์ + ช่วงวัน
  const t = await db.oneOrNone<Pick<trip, "username" | "start_plan" | "end_plan">>(
    `SELECT username, start_plan, end_plan
     FROM public.trip
     WHERE id = $1`,
    [input.trip_id]
  );
  if (!t) {
    throw new Error(`ไม่พบ trip_id='${input.trip_id}'`);
  }
  if (!isAdmin && t.username !== accessor.username) {
    throw new Error("forbidden: คุณไม่ใช่เจ้าของทริปนี้");
  }

  // 2) เช็คช่วงวัน: db-promise ตั้ง parser ให้ date เป็น 'YYYY-MM-DD' แล้ว -> เปรียบเทียบสตริงได้
  const start = String(t.start_plan);
  const end = String(t.end_plan);
  if (!(date >= start && date <= end)) {
    throw new Error(`วันที่ ${date} อยู่นอกช่วงทริป [${start} .. ${end}]`);
  }

  // 3) INSERT
  try {
    const row = await db.one<day_trip>(
      `INSERT INTO public.day_trip (id, trip_id, date, header, geometry)
       VALUES ($[id], $[trip_id], $[date]::date, $[header], $[geometry])
       RETURNING id, trip_id, created_at, date, header, geometry, updated_at`,
      {
        id,
        trip_id: input.trip_id,
        date,
        header: input.header ?? null,
        geometry: input.geometry ?? null,
      }
    );
    return row;
  } catch (err: any) {
    // 23505 = unique_violation (ชน UNIQUE (trip_id, date))
    if (err?.code === "23505") {
      // ชื่อดัชนี unique ในสคีมาของคุณคือ ux_day_project_unique_day
      throw new Error("มี day_trip สำหรับวันนี้ในทริปนี้อยู่แล้ว (trip_id, date ต้องไม่ซ้ำ)");
    }
    // 23503 = foreign_key_violation (trip_id ไม่พบ)
    if (err?.code === "23503") {
      throw new Error("trip_id ไม่ถูกต้อง (FK ล้มเหลว)");
    }
    throw err;
  }
}

/** ถ้าต้องการเวอร์ชันไม่เช็คสิทธิ์ (internal only / job) */
export async function createDayTrip(input: CreateDayTripInput): Promise<day_trip> {
  const adminAccessor: Accessor = { username: "__system__", is_staff_user: true };
  return createDayTripAuthorized(adminAccessor, input);
}

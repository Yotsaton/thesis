// src/trip/function/createTrip.ts
import { db } from "../../database/db-promise";
import type { trip } from "../../database/database.types";

import { CreateTripParams } from "../types/type";
import { toDateOnly } from "./toDateOnly";

/**
 * บันทึกทริปใหม่ลงตาราง public.trip
 * - คืนค่ารายการทริปที่ถูกสร้าง (type: trip)
 */
export async function createTrip(params: CreateTripParams): Promise<trip> {
  const status = "planning";
  const header = params.header ?? null;

  const start = toDateOnly(params.start_plan);
  const end = toDateOnly(params.end_plan);

  // ป้องกัน fail จาก CHECK constraint (end_plan >= start_plan)
  if (end < start) {
    throw new Error(`end_plan (${end}) ต้องไม่น้อยกว่า start_plan (${start})`);
  }

  try {
    // ใช้ db.one เพื่อคืนค่าบรรทัดเดียว พร้อม map เป็น trip
    const row = await db.one<trip>(
      `
      INSERT INTO public.trip (username, start_plan, end_plan, status, header)
      VALUES ($[username], $[start], $[end], $[status], $[header])
      RETURNING
        id,
        username,
        start_plan,
        end_plan,
        status,
        created_at,
        header,
        updated_at
      `,
      {
        username: params.username,
        start,
        end,
        status,
        header,
      }
    );

    // หมายเหตุ: driver ปกติจะให้ชนิด date/timestamp มาเป็น string;
    return row;
  } catch (err: any) {
    // แปลง error จาก Postgres ให้อ่านง่ายขึ้น
    // 23503 = foreign_key_violation, 23514 = check_violation
    if (err?.code === "23503") {
      throw new Error(
        `ไม่พบ username='${params.username}' ในตาราง users (FK ล้มเหลว)`
      );
    }
    if (err?.code === "23514") {
      throw new Error(
        `ข้อมูลไม่ผ่านเงื่อนไขของตาราง trip (เช่น end_plan ต้อง >= start_plan)`
      );
    }
    // กรณีอื่นคงเดิม
    throw err;
  }
}

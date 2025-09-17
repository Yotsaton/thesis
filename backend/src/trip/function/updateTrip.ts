// src/trip/function/updateTrip.ts
import { db } from "../../database/db-promise";
import type { trip } from "../../database/database.types";
import { Accessor, TripPatch, UpdateOptions } from "../types/type";
import { toDateOnly } from "./toDateOnly";

/**
 * แก้ไขข้อมูลทริปตาม id
 * - ผู้ใช้ทั่วไป: แก้ได้เฉพาะทริปของตัวเอง
 * - แอดมิน/สตาฟ: แก้ของใครก็ได้ (และย้ายเจ้าของทริปได้ ถ้าส่ง patch.username)
 * - คืนค่าแถวที่อัปเดตแล้ว (type: trip)
 */
export async function updateTripAuthorized(
  accessor: Accessor,
  id: string,
  patch: TripPatch,
  opts: UpdateOptions = {}
): Promise<trip> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);

  // เตรียมฟิลด์ที่จะอัปเดตแบบ dynamic
  const sets: string[] = [];
  const params: any = {
    id,
    accessor_username: accessor.username,
  };

  if (patch.header !== undefined) {
    params.header = patch.header;
    sets.push(`header = $[header]`);
  }
  if (patch.status !== undefined) {
    params.status = patch.status;
    sets.push(`status = $[status]`);
  }
  if (patch.start_plan !== undefined) {
    params.start_plan = toDateOnly(patch.start_plan);
    sets.push(`start_plan = $[start_plan]::date`);
  }
  if (patch.end_plan !== undefined) {
    params.end_plan = toDateOnly(patch.end_plan);
    sets.push(`end_plan = $[end_plan]::date`);
  }
  if (patch.username !== undefined) {
    if (!isAdmin) {
      throw new Error("forbidden: มีเพียงแอดมิน/สตาฟเท่านั้นที่ย้ายเจ้าของทริปได้");
    }
    params.new_owner = patch.username;
    sets.push(`username = $[new_owner]`);
  }

  if (sets.length === 0) {
    throw new Error("ไม่มีฟิลด์ใดให้แก้ไข (patch ว่าง)");
  }

  // ตรวจสอบช่วงวันถ้าส่งมาทั้งคู่ (ถ้าส่งมาแค่ฝั่งเดียว ปล่อยให้ DB ตรวจด้วย CHECK)
  if (params.start_plan && params.end_plan) {
    if (params.end_plan < params.start_plan) {
      throw new Error(
        `end_plan (${params.end_plan}) ต้องไม่น้อยกว่า start_plan (${params.start_plan})`
      );
    }
  }

  // เงื่อนไขสิทธิ์ + optimistic concurrency
  const whereParts = [`t.id = $[id]`];
  if (!isAdmin) whereParts.push(`t.username = $[accessor_username]`);
  if (opts.ifMatchUpdatedAt) {
    params.ifMatch = opts.ifMatchUpdatedAt;
    whereParts.push(`t.updated_at = $[ifMatch]`);
  }

  const sql = `
    UPDATE public.trip AS t
    SET ${sets.join(", ")},
        updated_at = now()
    WHERE ${whereParts.join(" AND ")}
    RETURNING
      t.id,
      t.username,
      t.start_plan,
      t.end_plan,
      t.status,
      t.created_at,
      t.header,
      t.updated_at
  `;

  try {
    const row = await db.oneOrNone<trip>(sql, params);
    if (!row) {
      // อาจเป็น: ไม่พบ id, ไม่มีสิทธิ์แก้, หรือ ifMatchUpdatedAt ไม่ตรง
      if (!isAdmin) {
        throw new Error(
          "ไม่พบทริป หรือคุณไม่มีสิทธิ์แก้ไข / ข้อมูลไม่ทันสมัย (updated_at ไม่ตรง)"
        );
      }
      throw new Error("ไม่พบทริปตาม id หรือข้อมูลไม่ทันสมัย (updated_at ไม่ตรง)");
    }
    return row;
  } catch (err: any) {
    // 23514 = check_violation (เช่น end_plan < start_plan)
    if (err?.code === "23514") {
      throw new Error("ข้อมูลไม่ผ่านเงื่อนไข (end_plan ต้อง >= start_plan)");
    }
    // 23503 = foreign_key_violation (เช่น ย้ายไป username ที่ไม่มีใน users)
    if (err?.code === "23503") {
      throw new Error("username ใหม่ไม่ถูกต้อง (FK ล้มเหลว)");
    }
    throw err;
  }
}

/** ผู้ใช้ทั่วไป: แก้ได้เฉพาะของตัวเอง */
export async function updateMyTrip(
  me: Accessor,
  id: string,
  patch: TripPatch,
  opts?: UpdateOptions
) {
  return updateTripAuthorized(me, id, patch, opts);
}

/** แอดมิน/สตาฟ: แก้ของใครก็ได้ */
export async function adminUpdateTrip(
  admin: Accessor,
  id: string,
  patch: TripPatch,
  opts?: UpdateOptions
) {
  if (!(admin.is_super_user || admin.is_staff_user)) {
    throw new Error("forbidden: admin/staff only");
  }
  return updateTripAuthorized(admin, id, patch, opts);
}

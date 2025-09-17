// src/trip/function/deleteTrip.ts
import { db } from "../../database/db-promise";
import type { trip } from "../../database/database.types";
import { Accessor, UpdateOptions  } from "../types/type";

/**
 * ลบทริปตาม id
 * - ผู้ใช้ทั่วไป: ลบได้เฉพาะทริปของตัวเอง
 * - แอดมิน/สตาฟ: ลบของใครก็ได้
 * - คืนค่าแถวที่ถูกลบ (type: trip) เพื่อใช้ทำ undo/log ได้
 */
export async function deleteTripAuthorized(
  accessor: Accessor,
  id: string,
  opts: UpdateOptions = {}
): Promise<trip> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);

  const whereParts = [`t.id = $[id]`];
  const params: any = { id, accessor_username: accessor.username };

  if (!isAdmin) {
    // บังคับเจ้าของเท่านั้น
    whereParts.push(`t.username = $[accessor_username]`);
  }

  if (opts.ifMatchUpdatedAt) {
    params.ifMatch = opts.ifMatchUpdatedAt;
    whereParts.push(`t.updated_at = $[ifMatch]`);
  }

  const sql = `
    DELETE FROM public.trip AS t
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
      // ไม่พบ/ไม่มีสิทธิ์/หรือ ifMatch ไม่ตรง
      if (!isAdmin) {
        throw new Error("ไม่พบทริป หรือคุณไม่มีสิทธิ์ลบ / ข้อมูลไม่ทันสมัย (updated_at ไม่ตรง)");
      }
      throw new Error("ไม่พบทริปตาม id หรือข้อมูลไม่ทันสมัย (updated_at ไม่ตรง)");
    }
    return row;
  } catch (err: any) {
    // 23503 = foreign_key_violation (มีตารางอื่นอ้างอิงอยู่)
    if (err?.code === "23503") {
      throw new Error(
        "ลบไม่ได้ เนื่องจากมีข้อมูลอื่นอ้างอิงทริปนี้อยู่ (FK ล้มเหลว) — พิจารณา ON DELETE CASCADE หรือจัดการลบข้อมูลลูกก่อน"
      );
    }
    throw err;
  }
}

/** ผู้ใช้ทั่วไป: ลบของตัวเองเท่านั้น */
export async function deleteMyTrip(
  me: Accessor,
  id: string,
  opts?: UpdateOptions
) {
  return deleteTripAuthorized(me, id, opts);
}

/** แอดมิน/สตาฟ: ลบของใครก็ได้ */
export async function adminDeleteTrip(
  admin: Accessor,
  id: string,
  opts?: UpdateOptions
) {
  if (!(admin.is_super_user || admin.is_staff_user)) {
    throw new Error("forbidden: admin/staff only");
  }
  return deleteTripAuthorized(admin, id, opts);
}

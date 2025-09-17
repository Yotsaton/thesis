// src/services/day-trip/deleteDayTrip.ts
import { db } from "../../database/db-promise";
import type { day_trip } from "../../database/database.types";
import type { Accessor , UpdateOptions} from "../types/types";

/**
 * ลบ day_trip แบบมีสิทธิ์:
 * - ผู้ใช้ทั่วไป: ลบได้เฉพาะ day_trip ที่อยู่ใต้ทริปของตัวเอง
 * - แอดมิน/สตาฟ: ลบของใครก็ได้
 * - คืนค่าบรรทัดที่ถูกลบ (ใช้ทำ log/undo ได้)
 */
export async function deleteDayTripAuthorized(
  accessor: Accessor,
  id: string,
  opts: UpdateOptions = {}
): Promise<day_trip> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);

  const whereParts: string[] = [
    `d.id = $[id]`,
    `t.id = d.trip_id`,
  ];

  const params: any = {
    id,
    accessor_username: accessor.username,
  };

  if (!isAdmin) {
    // ผู้ใช้ทั่วไป: บังคับเจ้าของทริป
    whereParts.push(`t.username = $[accessor_username]`);
  }

  if (opts.ifMatchUpdatedAt) {
    params.ifMatch = opts.ifMatchUpdatedAt;
    whereParts.push(`d.updated_at = $[ifMatch]`);
  }

  // ใช้ DELETE ... USING เพื่อ join กับ trip ตรวจสิทธิ์ในคำสั่งเดียว
  const sql = `
    DELETE FROM public.day_trip AS d
    USING public.trip AS t
    WHERE ${whereParts.join(" AND ")}
    RETURNING
      d.id,
      d.trip_id,
      d.created_at,
      d.date,
      d.header,
      d.geometry,
      d.updated_at
  `;

  try {
    const row = await db.oneOrNone<day_trip>(sql, params);
    if (!row) {
      // ไม่พบ / ไม่มีสิทธิ์ / หรือ ifMatch ไม่ตรง
      if (!isAdmin) {
        throw new Error("ไม่พบ day_trip หรือคุณไม่มีสิทธิ์ลบ / ข้อมูลไม่ทันสมัย (updated_at ไม่ตรง)");
      }
      throw new Error("ไม่พบ day_trip ตาม id หรือข้อมูลไม่ทันสมัย (updated_at ไม่ตรง)");
    }
    return row;
  } catch (err: any) {
    // ถ้ายังมี FK ลูกที่ไม่ได้ตั้ง CASCADE อาจขึ้น 23503
    if (err?.code === "23503") {
      throw new Error("ลบไม่ได้ เนื่องจากมีข้อมูลอื่นอ้างอิงอยู่ (FK ล้มเหลว) — พิจารณา ON DELETE CASCADE หรือลบข้อมูลลูกก่อน");
    }
    throw err;
  }
}

/** ผู้ใช้ทั่วไป: ลบของตัวเองเท่านั้น */
export async function deleteMyDayTrip(
  me: Accessor,
  id: string,
  opts?: UpdateOptions
) {
  return deleteDayTripAuthorized(me, id, opts);
}

/** แอดมิน/สตาฟ: ลบของใครก็ได้ */
export async function adminDeleteDayTrip(
  admin: Accessor,
  id: string,
  opts?: UpdateOptions
) {
  if (!(admin.is_super_user || admin.is_staff_user)) {
    throw new Error("forbidden: admin/staff only");
  }
  return deleteDayTripAuthorized(admin, id, opts);
}

// src/dayTrip/function/updateDayTrip.ts
import { db } from "../../database/db-promise";
import type { day_trip, trip } from "../../database/database.types";
import type { Accessor, DayTripPatch, UpdateOptions } from "../types/types";

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
 * อัปเดต day_trip แบบมีสิทธิ์:
 * - ผู้ใช้ทั่วไป: อัปเดตได้เฉพาะ day_trip ที่อยู่ในทริปของตัวเอง
 *   และ "หากย้ายทริป" ต้องย้ายไปทริปที่ตัวเองเป็นเจ้าของเท่านั้น
 * - แอดมิน/สตาฟ: อัปเดต/ย้ายได้ทุกทริป
 * - ถ้าเปลี่ยน date/trip_id จะตรวจช่วงวันให้สอดคล้องกับทริปเป้าหมาย
 * - คืนค่าบรรทัดที่อัปเดตแล้ว
 */
export async function updateDayTripAuthorized(
  accessor: Accessor,
  id: string,
  patch: DayTripPatch,
  opts: UpdateOptions = {}
): Promise<day_trip> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);
  if (
    patch.header === undefined &&
    patch.date === undefined &&
    patch.geometry === undefined &&
    patch.trip_id === undefined
  ) {
    throw new Error("ไม่มีฟิลด์ให้แก้ไข (patch ว่าง)");
  }

  // 1) โหลด day_trip ปัจจุบัน + เจ้าของทริปเดิม (สำหรับตรวจสิทธิ์เบื้องต้น)
  const cur = await db.oneOrNone<{
    d_trip_id: string;
    d_date: string;           // สมมติ db-promise พาร์ส date เป็น 'YYYY-MM-DD'
    owner: string;
  }>(
    `
    SELECT d.trip_id AS d_trip_id, d.date AS d_date, t.username AS owner
    FROM public.day_trip d
    JOIN public.trip   t ON t.id = d.trip_id
    WHERE d.id = $1
    `,
    [id]
  );
  if (!cur) throw new Error("ไม่พบ day_trip ตาม id");

  if (!isAdmin && cur.owner !== accessor.username) {
    throw new Error("forbidden: คุณไม่มีสิทธิ์แก้ไข day_trip นี้");
  }

  // 2) คำนวณทริปเป้าหมายและวันที่เป้าหมาย (หลังอัปเดต)
  const targetTripId = patch.trip_id ?? cur.d_trip_id;
  const targetDate = patch.date ? toDateOnly(patch.date) : cur.d_date;

  // 3) โหลดข้อมูลทริปเป้าหมาย เพื่อตรวจสิทธิ์ (กรณีย้ายทริป) + ตรวจช่วงวัน
  const targetTrip = await db.oneOrNone<Pick<trip, "username" | "start_plan" | "end_plan">>(
    `SELECT username, start_plan, end_plan FROM public.trip WHERE id = $1`,
    [targetTripId]
  );
  if (!targetTrip) throw new Error(`ไม่พบ trip_id เป้าหมาย '${targetTripId}'`);

  if (!isAdmin && targetTrip.username !== accessor.username) {
    // ผู้ใช้ทั่วไป ถ้าจะย้ายทริป ต้องเป็นทริปของตัวเองเท่านั้น
    if (patch.trip_id && patch.trip_id !== cur.d_trip_id) {
      throw new Error("forbidden: คุณย้าย day_trip ไปทริปของคนอื่นไม่ได้");
    }
  }

  // ตรวจช่วงวัน
  const start = String(targetTrip.start_plan);
  const end = String(targetTrip.end_plan);
  if (!(targetDate >= start && targetDate <= end)) {
    throw new Error(`วันที่ ${targetDate} อยู่นอกช่วงของทริป [${start} .. ${end}]`);
  }

  // 4) สร้าง SET clause แบบ dynamic
  const sets: string[] = [];
  const params: any = { id, targetDate, targetTripId, accessor_username: accessor.username };

  if (patch.header !== undefined) {
    params.header = patch.header;
    sets.push(`d.header = $[header]`);
  }
  if (patch.geometry !== undefined) {
    params.geometry = patch.geometry;
    sets.push(`d.geometry = $[geometry]`);
  }
  if (patch.date !== undefined) {
    sets.push(`d.date = $[targetDate]::date`);
  }
  if (patch.trip_id !== undefined) {
    sets.push(`d.trip_id = $[targetTripId]`);
  }

  // ifMatch (optimistic)
  const whereParts: string[] = [`d.id = $[id]`];
  if (opts.ifMatchUpdatedAt) {
    params.ifMatch = opts.ifMatchUpdatedAt;
    whereParts.push(`d.updated_at = $[ifMatch]`);
  }

  // ถ้า "ไม่ใช่แอดมิน" ให้บังคับสิทธิ์ใน SQL อีกชั้น (อิงทริปหลังอัปเดต)
  // เคล็ดลับ: ใช้ FROM ผูกกับ trip เป้าหมายหลังอัปเดต ด้วยเงื่อนไข OR ที่ครอบทั้งสองกรณี
  // แต่เพื่อความชัด เราแบ่งเป็นสองกรณีง่าย ๆ:
  const baseSql = `
    UPDATE public.day_trip AS d
    SET ${sets.join(", ")},
        updated_at = now()
    WHERE ${whereParts.join(" AND ")}
    RETURNING d.id, d.trip_id, d.created_at, d.date, d.header, d.geometry, d.updated_at
  `;

  try {
    if (!isAdmin) {
      // ตรวจสิทธิ์ซ้ำใน SQL: day_trip หลังอัปเดตต้องอยู่ใต้ทริปของ accessor
      // ทำได้โดยใส่เงื่อนไขเพิ่มเติมด้วย CTE: อัปเดตก่อน แล้วคืนค่ามาเช็คเจ้าของ
      // ที่ง่ายและอ่านออก: ทำใน TX 2 สเต็ป (UPDATE → SELECT join trip → verify)
      return await db.tx(async (t) => {
        const row = await t.oneOrNone<day_trip>(baseSql, params);
        if (!row) {
          throw new Error("ไม่พบ/ข้อมูลไม่ทันสมัย (updated_at ไม่ตรง) หรือไม่มีอะไรเปลี่ยน");
        }
        const ownerAfter = await t.one<{ username: string }>(
          `SELECT username FROM public.trip WHERE id = $1`,
          [row.trip_id]
        );
        if (ownerAfter.username !== accessor.username) {
          throw new Error("forbidden: หลังอัปเดต day_trip อยู่นอกทริปของคุณ");
        }
        return row;
      });
    } else {
      const row = await db.oneOrNone<day_trip>(baseSql, params);
      if (!row) {
        throw new Error("ไม่พบ/ข้อมูลไม่ทันสมัย (updated_at ไม่ตรง) หรือไม่มีอะไรเปลี่ยน");
      }
      return row;
    }
  } catch (err: any) {
    // 23505 = unique_violation (ชน UNIQUE (trip_id, date))
    if (err?.code === "23505") {
      throw new Error("ชนเงื่อนไขไม่ซ้ำ: มี day_trip ของทริปนี้ในวันที่นี้อยู่แล้ว");
    }
    // 23503 = foreign_key_violation (trip_id เป้าหมายไม่มีอยู่)
    if (err?.code === "23503") {
      throw new Error("trip_id ไม่ถูกต้อง (FK ล้มเหลว)");
    }
    throw err;
  }
}

/** ช่วยเรียกแบบง่าย: ผู้ใช้ทั่วไป */
export async function updateMyDayTrip(
  me: Accessor,
  id: string,
  patch: DayTripPatch,
  opts?: UpdateOptions
) {
  return updateDayTripAuthorized(me, id, patch, opts);
}

/** แอดมิน/สตาฟ */
export async function adminUpdateDayTrip(
  admin: Accessor,
  id: string,
  patch: DayTripPatch,
  opts?: UpdateOptions
) {
  if (!(admin.is_super_user || admin.is_staff_user)) {
    throw new Error("forbidden: admin/staff only");
  }
  return updateDayTripAuthorized(admin, id, patch, opts);
}

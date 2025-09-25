// src/trip/function/getTrips.ts
import { db } from "../../database/db-promise";
import type { trip } from "../../database/database.types";
import { Accessor, ListTripsOptions } from "../types/type";
import { th } from "zod/v4/locales";

function toDateOnly(input?: string | Date): string | undefined {
  if (!input) return undefined;
  if (input instanceof Date) {
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, "0");
    const d = String(input.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return input; // assume YYYY-MM-DD
}

export async function listTripsAuthorized(
  accessor: Accessor,
  opts: ListTripsOptions = {}
): Promise<{ items: trip[]; total: number; limit: number; offset: number }> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const orderBy =
    (opts.orderBy ?? "start_plan") as "start_plan" | "created_at" | "updated_at";
  const order = (opts.order ?? "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  const from = toDateOnly(opts.from);
  const to = toDateOnly(opts.to);

  const conditions: string[] = [];
  const params: any = { limit, offset, from, to, q: undefined as string | undefined };

  // สิทธิ์เข้าถึง
  if (isAdmin) {
    // แอดมิน: จะไม่บังคับ username ถ้าไม่ส่งมาก็ดึงทั้งหมดได้
    if (typeof opts.usernames === "string" && opts.usernames.trim() !== "") {
      params.usernames = [opts.usernames.trim()];
      conditions.push(`t.username = ANY($[usernames])`);
    } else if (Array.isArray(opts.usernames) && opts.usernames.length > 0) {
      params.usernames = opts.usernames;
      conditions.push(`t.username = ANY($[usernames])`);
    }
  } else {
    // ผู้ใช้ทั่วไป: บังคับเฉพาะของตัวเอง
    params.req_username = accessor.username;
    conditions.push(`t.username = $[req_username]`);
  }

  // ฟิลเตอร์วันที่
  if (from) conditions.push(`t.start_plan >= $[from]`);
  if (to) conditions.push(`t.end_plan <= $[to]`);

  // ฟิลเตอร์สถานะ
  if (typeof opts.status === "string" && opts.status.trim() !== "") {
    params.status = opts.status.trim();
    conditions.push(`t.status = $[status]`);
  } else if (Array.isArray(opts.status) && opts.status.length > 0) {
    params.status_array = opts.status;
    conditions.push(`t.status = ANY($[status_array])`);
  }

  // ค้นหา header แบบ full-text เบา ๆ ด้วย ILIKE
  if (opts.q && opts.q.trim() !== "") {
    params.q = `%${opts.q.trim()}%`;
    conditions.push(`t.header ILIKE $[q]`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const baseSelect = `
    SELECT
      t.id,
      t.username,
      t.start_plan,
      t.end_plan,
      t.status,
      t.created_at,
      t.header,
      t.updated_at
    FROM public.trip t
    ${whereClause}
  `;

  return db.task(async (t) => {
    const totalRow = await t.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM (${baseSelect}) sub`,
      params
    );
    const items = await t.any<trip>(
      `${baseSelect}
       ORDER BY ${orderBy} ${order}
       LIMIT $[limit] OFFSET $[offset]`,
      params
    );
    return {
      items,
      total: parseInt(totalRow.count, 10),
      limit,
      offset,
    };
  });
}

/** ช่วยเรียกแบบง่าย: ถ้าเป็นแอดมิน ไม่ส่ง opts.usernames = ดึงทั้งหมด; ถ้าเป็นยูสเซอร์ จะดึงเฉพาะของตัวเอง */
export async function getTrips(accessor: Accessor, opts?: ListTripsOptions) {
  return listTripsAuthorized(accessor, opts);
}
/** ดึงข้อมูล trip เดียวตาม trip_id */
export async function getTrip(accessor: Accessor, trip_id: string): Promise<trip> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);

  const trip = await db.oneOrNone<trip>(
    `
    SELECT
      t.id,
      t.username,
      t.start_plan,
      t.end_plan,
      t.status,
      t.created_at,
      t.header,
      t.updated_at
    FROM public.trip t
    WHERE t.id = $[trip_id] AND ($[isAdmin] OR t.username = $[req_username])
    `,
    { trip_id, isAdmin, req_username: accessor.username }
  );

  if (!trip) throw new Error("Trip not found");

  // ตรวจสอบสิทธิ์เข้าถึง
  if (!isAdmin && trip.username !== accessor.username) {
    throw new Error("Access denied");
  }

  return trip;
}

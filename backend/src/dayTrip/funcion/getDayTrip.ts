// src/dayTrip/function/getDayTrips.ts
import { db } from "../../database/db-promise";
import type { day_trip } from "../../database/database.types";
import type { Accessor, ListDayTripsOptions } from "../types/types";

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

/** ดึงรายการ day_trip แบบมีสิทธิ์ + แบ่งหน้า + กรอง */
export async function listDayTripsAuthorized(
  accessor: Accessor,
  opts: ListDayTripsOptions = {}
): Promise<{ items: day_trip[]; total: number; limit: number; offset: number }> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const orderBy = (opts.orderBy ?? "date") as "date" | "created_at" | "updated_at";
  const order = (opts.order ?? "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  const dateFrom = toDateOnly(opts.dateFrom);
  const dateTo = toDateOnly(opts.dateTo);

  const conditions: string[] = [];
  const params: any = {
    limit,
    offset,
    accessor_username: accessor.username,
    trip_id: opts.trip_id,
    dateFrom,
    dateTo,
  };

  // join กับ trip เพื่อตรวจสิทธิ์ที่ระดับ SQL
  // d = day_trip, t = trip (owner อยู่ใน t.username)
  // สิทธิ์: user ธรรมดาเห็นเฉพาะ t.username = accessor
  if (!isAdmin) {
    conditions.push(`t.username = $[accessor_username]`);
  }

  if (opts.trip_id) {
    conditions.push(`d.trip_id = $[trip_id]`);
  }
  if (dateFrom) {
    conditions.push(`d.date >= $[dateFrom]`);
  }
  if (dateTo) {
    conditions.push(`d.date <= $[dateTo]`);
  }
  if (opts.q && opts.q.trim() !== "") {
    params.q = `%${opts.q.trim()}%`;
    conditions.push(`d.header ILIKE $[q]`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const baseSelect = `
    SELECT
      d.id,
      d.trip_id,
      d.created_at,
      d.date,
      d.header,
      d.geometry,
      d.updated_at
    FROM public.day_trip AS d
    JOIN public.trip AS t ON t.id = d.trip_id
    ${whereClause}
  `;

  return db.task(async (t) => {
    const totalRow = await t.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM (${baseSelect}) sub`,
      params
    );
    const items = await t.any<day_trip>(
      `${baseSelect}
       ORDER BY d.${orderBy} ${order}
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

/** ดึง day_trip รายการเดียวตาม id แบบมีสิทธิ์ */
export async function getDayTripByIdAuthorized(
  accessor: Accessor,
  id: string,
  opts?: { includeDeletedTrips?: boolean }
): Promise<day_trip> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);

  const conditions: string[] = [`d.id = $[id]`];
  const params: any = { id, accessor_username: accessor.username };

  if (!isAdmin) {
    conditions.push(`t.username = $[accessor_username]`);
  }

  if (!opts?.includeDeletedTrips) {
    conditions.push(`(t.deleted_at IS NULL OR t.deleted_at IS NULL)`);
  }

  const sql = `
    SELECT
      d.id,
      d.trip_id,
      d.created_at,
      d.date,
      d.header,
      d.geometry,
      d.updated_at
    FROM public.day_trip AS d
    JOIN public.trip AS t ON t.id = d.trip_id
    WHERE ${conditions.join(" AND ")}
    LIMIT 1
  `;

  const row = await db.oneOrNone<day_trip>(sql, params);
  if (!row) {
    // ไม่พบ / ไม่มีสิทธิ์
    throw new Error("ไม่พบ day_trip ตาม id หรือคุณไม่มีสิทธิ์เข้าถึง");
  }
  return row;
}

/** helper: ดึงทั้งหมดของทริปเดียว (ค่าปริยายเรียงตามวันที่) */
export async function getDayTripsOfTripAuthorized(
  accessor: Accessor,
  trip_id: string
): Promise<day_trip[]> {
  const { items } = await listDayTripsAuthorized(accessor, { trip_id, orderBy: "date" });
  return items;
}

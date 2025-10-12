// src/activity/functions/getActivityLogs.ts
import type { ITask, IDatabase } from "pg-promise";
import { db } from "../../database/db-promise";
import { Accessor } from "../../middleware/type.api";
import { activity_log } from "../../database/database.types"
import { ActivityLogQuery, ActivityLogResult, ActivityLogRow } from "../types/types";


/**
 * ดึง activity log แบบมีการบังคับสิทธิ์:
 * - แอดมิน/สตาฟ: ใช้ทุก filter ได้
 * - ผู้ใช้ทั่วไป: บังคับให้เห็นเฉพาะ username ของตัวเอง (ignore query.username)
 * - ใช้ id เป็น keyset pagination เร็วและเสถียรกว่า offset
 */
export async function getActivityLogsAuthorized(
  accessor: Accessor,
  query: ActivityLogQuery = {},
  t?: ITask<any> | IDatabase<any>
): Promise<ActivityLogResult> {
  const runner = (t as any) ?? db;

  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);
  const {
    username,
    ip,
    activitySearch,
    timeFrom,
    timeTo,
    limit = 50,
    cursorId,
    sortAsc = false,
  } = query;

  const safeLimit = Math.max(1, Math.min(200, limit)); // cap 1..200
  const conds: string[] = [];
  const params: any[] = [];

  // สิทธิ์: user ธรรมดาเห็นเฉพาะของตัวเอง
  if (isAdmin) {
    if (username) {
      params.push(username);
      conds.push(`username = $${params.length}`);
    }
  } else {
    params.push(accessor.username);
    conds.push(`username = $${params.length}`);
  }

  // เวลา
  if (timeFrom) {
    params.push(new Date(timeFrom));
    conds.push(`created_at >= $${params.length}`);
  }
  if (timeTo) {
    params.push(new Date(timeTo));
    conds.push(`created_at < $${params.length}`);
  }

  // IP (inet) — ถ้ามี wildcard ให้ค้นแบบ text, ไม่งั้น exact
  if (ip) {
    if (ip.includes("%") || ip.includes("*")) {
      const pattern = ip.replace(/\*/g, "%");
      params.push(pattern);
      conds.push(`ip_addr::text ILIKE $${params.length}`);
    } else {
      params.push(ip);
      conds.push(`ip_addr = $${params.length}::inet`);
    }
  }

  // activity text search
  if (activitySearch) {
    params.push(`%${activitySearch}%`);
    conds.push(`activity ILIKE $${params.length}`);
  }

  // keyset pagination ด้วย id
  if (cursorId != null) {
    params.push(cursorId);
    if (sortAsc) {
      // หน้า "ก่อนหน้า" เมื่อเรียง ASC
      conds.push(`id > $${params.length}`);
    } else {
      // หน้า "ถัดไป" เมื่อเรียง DESC (ใหม่ก่อน)
      conds.push(`id < $${params.length}`);
    }
  }

  const whereSql = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  // เรียงลำดับ: ปกติใหม่ก่อน (DESC)
  const orderDir = sortAsc ? "ASC" : "DESC";

  // ดึงเกินมา 1 แถวเพื่อตรวจ hasMore
  params.push(safeLimit + 1);
  const limitParam = params.length;

  const sql = `
    SELECT
      id,
      username,
      ip_addr::text AS ip_addr,
      activity,
      created_at
    FROM public.activity_log
    ${whereSql}
    ORDER BY id ${orderDir}
    LIMIT $${limitParam}
  `;

  const rows = await runner.manyOrNone(sql, params);

  const hasMore = rows.length > safeLimit;
  const cut = hasMore ? rows.slice(0, safeLimit) : rows;

  // map + parse activity ถ้าเป็น JSON
  const items: ActivityLogRow[] = cut.map((r: any) => {
    let parsed: any | undefined;
    if (typeof r.activity === "string" && /^[\[{]/.test(r.activity.trim())) {
      try {
        parsed = JSON.parse(r.activity);
      } catch {
        /* ignore */
      }
    }
    return {
      id: Number(r.id),
      username: r.username,
      ip_addr: r.ip_addr,
      activity: r.activity,
      activity_json: parsed,
      created_at: new Date(r.created_at).toISOString(),
    };
  });

  let nextCursorId: number | undefined;
  if (!sortAsc) {
    // DESC: id ลดลงไปเรื่อย ๆ → next cursor = id สุดท้าย (น้อยสุดของหน้านี้)
    nextCursorId = items.length ? items[items.length - 1].id : undefined;
  } else {
    // ASC: id เพิ่มขึ้น → next cursor = id สุดท้าย (มากสุดของหน้านี้)
    nextCursorId = items.length ? items[items.length - 1].id : undefined;
  }

  return { items, hasMore, nextCursorId };
}

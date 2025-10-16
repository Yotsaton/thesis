// src/admin/functions/listUsers.ts
import { db } from "../../database/db-promise";
import type { Accessor } from "../../middleware/type.api";
import type { UserSummary, ListUsersOptions, ListUsersResult } from "../types/types";

/**
 * ดึงรายการผู้ใช้ทั้งหมด (Admin only)
 * - ค้นหา q ใน username/email (ILIKE)
 * - กรองตามบทบาท (role), verify, online, deleted
 * - จัดหน้า (page/page_size) และเรียงลำดับ (sort_by/order) พร้อม NULLS LAST
 *
 * Security:
 * - อนุญาตเฉพาะ super user เท่านั้น
 */
export async function listUsers(
  accessor: Accessor,
  opts: ListUsersOptions = {}
): Promise<ListUsersResult> {
  // --- 1) Admin only ---
  if (!accessor?.is_super_user) {
    throw new Error("forbidden_admin_only");
  }

  // --- 2) เตรียม options + sanitize ---
  const page = Math.max(1, Math.trunc(opts.page ?? 1));
  const pageSizeRaw = Math.trunc(opts.page_size ?? 20);
  const page_size = Math.min(Math.max(pageSizeRaw, 1), 100);

  const sortWhitelist: Record<string, string> = {
    username: "username",
    email: "email",
    created_at: "created_at",
    last_login: "last_login",
    last_seen: "last_seen",
  };
  const sort_by = (opts.sort_by && sortWhitelist[opts.sort_by]) ? opts.sort_by : "username";
  const order: "asc" | "desc" = (opts.order === "desc" ? "desc" : "asc");
  const offset = (page - 1) * page_size;

  // --- 3) เงื่อนไข WHERE แบบไดนามิก ---
  const where: string[] = ["1=1"];
  const params: any[] = [];

  // ค้นหาด้วย q ใน username/email (email เป็น CITEXT ก็ยังใช้ ILIKE ได้)
  if (opts.q && opts.q.trim()) {
    const kw = `%${opts.q.trim()}%`;
    where.push(`(username ILIKE $${params.length + 1} OR email::text ILIKE $${params.length + 2})`);
    params.push(kw, kw);
  }

  // กรองบทบาท
  if (opts.role === "super") {
    where.push(`is_super_user = TRUE`);
  } else if (opts.role === "staff") {
    where.push(`is_staff_user = TRUE`);
  } else if (opts.role === "user") {
    where.push(`is_super_user = FALSE AND is_staff_user = FALSE`);
  }

  // กรองสถานะยืนยันอีเมล
  if (typeof opts.verify === "boolean") {
    where.push(`is_verify = $${params.length + 1}`);
    params.push(opts.verify);
  }

  // กรองสถานะออนไลน์
  if (typeof opts.online === "boolean") {
    where.push(`is_online = $${params.length + 1}`);
    params.push(opts.online);
  }

  // กรองสถานะลบ (ค่า default: false → แสดงเฉพาะที่ยังไม่ถูกลบ)
  if (typeof opts.deleted === "boolean") {
    where.push(`is_deleted = $${params.length + 1}`);
    params.push(opts.deleted);
  } else {
    where.push(`is_deleted = FALSE`);
  }

  const whereSQL = where.join(" AND ");

  // --- 4) นับจำนวนรวม ---
  const { count: total } = await db.one<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM public.users
      WHERE ${whereSQL}`,
    params
  );

  // --- 5) ดึงข้อมูลหน้าเฉพาะ ---
  // หมายเหตุ: ORDER BY ใช้ whitelist เพื่อกัน SQL injection
  const rows = await db.any<UserSummary>(
    `SELECT
        username,
        email,
        is_super_user,
        is_staff_user,
        is_verify,
        is_online,
        last_login,
        last_seen,
        created_at,
        is_deleted,
        deleted_at
       FROM public.users
      WHERE ${whereSQL}
   ORDER BY ${sortWhitelist[sort_by]} ${order.toUpperCase()} NULLS LAST
      LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
    [...params, page_size, offset]
  );

  return {
    meta: {
      page,
      page_size,
      total,
      total_pages: Math.max(1, Math.ceil(total / page_size)),
      sort_by: sort_by as NonNullable<ListUsersOptions["sort_by"]>,
      order,
    },
    data: rows,
  };
}

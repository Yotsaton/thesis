// src/admin/functions/deleteUser.ts
import { db } from "../../database/db-promise";
import type { Accessor } from "../../middleware/type.api";
import type { DeleteUserOptions, UserSummary } from "../types/types";

/**
 * ลบผู้ใช้ (Admin only)
 * - ค่าเริ่มต้น: soft delete (is_deleted = TRUE, deleted_at = now(), is_online = FALSE, token_version + 1)
 * - ออปชัน hard: ลบแถวออกจากตารางจริง ๆ (ระวัง FK)
 * - ป้องกัน:
 *    - ลบตัวเอง
 *    - ลบ super user คนสุดท้าย
 *
 * @param accessor ผู้เรียกใช้งาน ต้องเป็น super user
 * @param username ผู้ใช้เป้าหมาย
 * @param opts.hard ลบจริง (default false = soft delete)
 * @returns รายละเอียดผู้ใช้หลังการลบ (สำหรับ hard delete จะคืนค่าก่อนถูกลบ)
 */
export async function deleteUser(
  accessor: Accessor,
  username: string,
  opts: DeleteUserOptions = {}
): Promise<UserSummary> {
  // 1) admin only
  if (!accessor?.is_super_user) {
    throw new Error("forbidden_admin_only");
  }

  const uname = (username ?? "").trim();
  if (!uname) throw new Error("invalid_input_username_required");

  // 2) ห้ามลบตัวเอง
  if (accessor.username === uname) {
    throw new Error("cannot_delete_self");
  }

  const hard = Boolean(opts.hard);

  return db.tx(async (t) => {
    // 3) อ่านผู้ใช้เป้าหมาย
    const target = await t.oneOrNone<UserSummary>(
      `SELECT username, email, is_super_user, is_staff_user, is_verify, is_online,
              last_login, last_seen, created_at, is_deleted, deleted_at
         FROM public.users
        WHERE username = $1
        LIMIT 1`,
      [uname]
    );
    if (!target) throw new Error("user_not_found");

    // 4) ถ้าจะลบ super user → ต้องไม่ใช่คนสุดท้าย
    if (target.is_super_user) {
      const remain = await t.one<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM public.users
          WHERE is_super_user = TRUE
            AND username <> $1
            AND is_deleted = FALSE`,
        [uname]
      );
      if (remain.count === 0) {
        throw new Error("cannot_delete_last_super_user");
      }
    }

    if (!hard) {
      // 5) SOFT DELETE: ทำให้ idempotent (ถ้าเคยลบแล้วก็เพียงคืน snapshot ล่าสุด)
      const updated = await t.one<UserSummary>(
        `UPDATE public.users
            SET is_deleted   = TRUE,
                deleted_at   = COALESCE(deleted_at, NOW()),
                is_online    = FALSE,
                token_version = token_version + 1
          WHERE username = $1
        RETURNING username, email, is_super_user, is_staff_user, is_verify, is_online,
                  last_login, last_seen, created_at, is_deleted, deleted_at`,
        [uname]
      );
      return updated;
    }

    // 6) HARD DELETE: ลบจริง (ระวัง FK ถ้าไม่มี CASCADE อาจโยน error)
    //    เก็บ snapshot เพื่อคืนค่าหลังลบสำเร็จ
    const snapshot = target;

    try {
      await t.none(
        `DELETE FROM public.users
          WHERE username = $1`,
        [uname]
      );
    } catch (e: any) {
      // ช่วยตีความ FK constraints เพื่อแจ้ง error ที่อ่านง่ายขึ้น
      const msg = String(e?.message || "");
      if (msg.includes("foreign key") || msg.includes("violates foreign key constraint")) {
        throw new Error("hard_delete_fk_violation");
      }
      throw e;
    }

    // คืน snapshot (ผู้ใช้ถูกลบออกจริงแล้ว)
    return snapshot;
  });
}

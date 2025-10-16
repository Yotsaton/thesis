// src/admin/functions/updateUserRole.ts
import { db } from "../../database/db-promise";
import type { Accessor } from "../../middleware/type.api";
import type { UserRoleDTO } from "../types/types";

/**
 * อัปเดต Role ของผู้ใช้ (Admin only)
 * - ส่งค่าเป็น boolean เพื่อกำหนดค่าใหม่ (true/false)
 * - ส่งเป็น null เพื่อ "ไม่เปลี่ยน" ค่านั้น
 * - ป้องกันการลดสิทธิ์ตัวเองจาก super user
 * - ป้องกันไม่ให้ระบบเหลือ super user = 0 คน
 *
 * @param accessor ข้อมูลผู้เรียกใช้งาน (ต้องเป็น super user)
 * @param username ผู้ใช้เป้าหมาย
 * @param is_super_user true/false เพื่อเซ็ตค่า หรือ null เพื่อไม่เปลี่ยน
 * @param is_staff_user true/false เพื่อเซ็ตค่า หรือ null เพื่อไม่เปลี่ยน
 * @returns username และสถานะ role ล่าสุดหลังอัปเดต
 */
export async function updateUserRole(
  accessor: Accessor,
  username: string,
  is_super_user: boolean | null = null,
  is_staff_user: boolean | null = null
): Promise<UserRoleDTO> {
  // 1) ตรวจสิทธิ์: admin only (super user)
  if (!accessor?.is_super_user) {
    throw new Error("forbidden_admin_only");
  }

  const uname = (username ?? "").trim();
  if (!uname) {
    throw new Error("invalid_input_username_required");
  }

  // ต้องมีอย่างน้อยหนึ่งฟิลด์ที่จะเปลี่ยน
  if (is_super_user === null && is_staff_user === null) {
    throw new Error("invalid_input_no_role_change");
  }

  // กันการ demote ตัวเองจาก super user
  if (accessor.username === uname && is_super_user === false) {
    throw new Error("cannot_demote_self_from_super_user");
  }

  return db.tx(async (t) => {
    // 2) ตรวจว่ามีผู้ใช้จริง
    const target = await t.oneOrNone<UserRoleDTO>(
      `SELECT username, is_super_user, is_staff_user
         FROM public.users
        WHERE username = $1
        LIMIT 1`,
      [uname]
    );
    if (!target) throw new Error("user_not_found");

    // 3) ถ้ากำลังจะถอด super user และเป้าหมายปัจจุบันเป็น super user
    if (target.is_super_user && is_super_user === false) {
      const remain = await t.one<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM public.users
          WHERE is_super_user = TRUE
            AND username <> $1`,
        [uname]
      );
      if (remain.count === 0) {
        throw new Error("cannot_remove_last_super_user");
      }
    }

    // 4) อัปเดตแบบอะตอมมิก คืนค่าผลลัพธ์ทันที
    const updated = await t.one<UserRoleDTO>(
      `UPDATE public.users
          SET is_super_user = COALESCE($2::boolean, is_super_user),
              is_staff_user = COALESCE($3::boolean, is_staff_user)
        WHERE username = $1
      RETURNING username, is_super_user, is_staff_user`,
      [uname, is_super_user, is_staff_user]
    );
    
    return updated;
  });
}

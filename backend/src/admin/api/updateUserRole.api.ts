// src/admin/api/updateUserRole.api.ts

import { AuthenticatedRequest } from "../../middleware/type.api";
import type { Accessor } from "../../middleware/type.api";
import { updateUserRole } from "../functions/updateUserRole";
import { usernameParamsSchema, updateUserRoleSchema, zodBadRequest } from "../types/types.api";

/**
 * PATCH /admin/users/:username/role
 * - อัปเดตบทบาทผู้ใช้ (Super user เท่านั้น)
 * - body: { is_super_user?: boolean|null, is_staff_user?: boolean|null }
 */
export async function updateUserRoleApi(req: AuthenticatedRequest, res: any) {
  try {
    const p = usernameParamsSchema.safeParse(req.params);
    if (!p.success) return zodBadRequest(res, p.error);

    const b = updateUserRoleSchema.safeParse(req.body ?? {});
    if (!b.success) return zodBadRequest(res, b.error);

    const auth = (req as any).auth as Accessor;
    const updated = await updateUserRole(
      auth,
      p.data.username,
      b.data.is_super_user ?? null,
      b.data.is_staff_user ?? null
    );

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[PATCH /admin/users/:username/role]", err);
    const msg = String(err?.message || "unexpected_error");
    const status =
      msg === "user_not_found" ? 404 :
      msg.startsWith("forbidden_") ? 403 :
      msg.startsWith("unauthorized_") ? 401 :
      400;

    res.status(status).json({
      success: false,
      error: msg,
      message: msg,
    });
  }
};


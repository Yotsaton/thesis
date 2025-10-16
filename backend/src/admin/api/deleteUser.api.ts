// src/admin/api/deleteUser.api.ts
import { AuthenticatedRequest } from "../../middleware/type.api";
import type { Accessor } from "../../middleware/type.api";
import { deleteUser } from "../functions/deleteUser";
import { zodBadRequest, usernameParamsSchema, deleteUserBodySchema, deleteUserQuerySchema } from "../types/types.api";

/**
 * DELETE /admin/users/:username
 * - ลบผู้ใช้ (Super user เท่านั้น)
 * - soft delete (default): is_deleted = TRUE, deleted_at = now(), is_online = FALSE, token_version + 1
 * - hard delete (optional): ?hard=true หรือ body { hard: true }
 */
export async function deleteUserApi(req: AuthenticatedRequest, res: any) {
  try {
    const p = usernameParamsSchema.safeParse(req.params);
    if (!p.success) return zodBadRequest(res, p.error);

    const q = deleteUserQuerySchema.safeParse(req.query);
    if (!q.success) return zodBadRequest(res, q.error);

    const b = deleteUserBodySchema.safeParse(req.body ?? {});
    if (!b.success) return zodBadRequest(res, b.error);

    const hard = typeof b.data.hard !== "undefined" ? b.data.hard : (q.data.hard ?? false);

    const auth = (req as any).auth as Accessor;
    const deleted = await deleteUser(auth, p.data.username, { hard });

    res.json({ success: true, data: deleted, hard });
  } catch (err: any) {
    console.error("[DELETE /admin/users/:username]", err);
    const msg = String(err?.message || "unexpected_error");
    const status =
      msg === "user_not_found" ? 404 :
      msg.startsWith("forbidden_") ? 403 :
      msg.startsWith("unauthorized_") ? 401 :
      msg === "hard_delete_fk_violation" ? 409 :
      400;

    res.status(status).json({
      success: false,
      error: msg,
      message: msg,
    });
  }
};

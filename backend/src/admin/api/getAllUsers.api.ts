// src/admin/api/getAllUsers.api.ts

import { z } from "zod";
import type { Accessor, AuthenticatedRequest } from "../../middleware/type.api";
import { listUsers } from "../functions/getAllUsers";
import { getUsersQuerySchema } from "../types/types.api";
import { QuerySchema } from "../../activity/types/types.api";

function zodBadRequest(res: any, err: z.ZodError) {
  return res.status(400).json({
    success: false,
    error: "zod_validation_error",
    message: "Invalid query parameters",
    details: err.issues,
  });
}

/**
 * 
 * - ดึงรายชื่อผู้ใช้ทั้งหมด (Super user เท่านั้น)
 * - รองรับ query: q, role, verify, online, deleted, page, page_size, sort_by, order
 */
export async function getAllUsersApi(req: AuthenticatedRequest, res: any) {
  try {
    const parsed = getUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) return zodBadRequest(res, parsed.error);

    const auth = (req as any).auth as Accessor;
    const result = await listUsers(auth, parsed.data);

    res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error("[GET /admin/users]", err);
    res.status(400).json({
      success: false,
      error: err?.message || "unexpected_error",
      message: err?.message || "unexpected_error",
    });
  }
};

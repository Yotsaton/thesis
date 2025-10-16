import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/type.api";

/**
 * อัปเดต Role ของผู้ใช้
 * ใช้สำหรับผู้ดูแลระบบเท่านั้น (requireAdmin)
 */
export async function updateUserRole(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!id || !role) {
      return res.status(400).json({
        success: false,
        message: "User ID and role are required",
      });
    }

    const validRoles = ["user", "admin", "staff"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    const updated = await req.db.user.update({
      where: { id },
      data: { role },
    });

    return res.status(200).json({
      success: true,
      message: `Updated role of user ${id} to ${role}`,
      data: updated,
    });
  } catch (err) {
    console.error("[updateUserRole]", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update user role",
      error: String(err),
    });
  }
}

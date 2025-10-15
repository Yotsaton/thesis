import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/type.api";

/**
 * ลบผู้ใช้จากระบบ (Admin เท่านั้น)
 */
export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // ตรวจสอบว่าผู้ใช้มีอยู่จริงก่อนลบ
    const existingUser = await req.db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await req.db.user.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: `User ${id} deleted successfully`,
    });
  } catch (err) {
    console.error("[deleteUser]", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: String(err),
    });
  }
}

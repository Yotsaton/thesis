import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/type.api";

/**
 * ดึงรายชื่อผู้ใช้ทั้งหมดในระบบ
 * ใช้เฉพาะผู้ที่มี role = 'admin'
 */
export async function getAllUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const users = await req.db.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    console.error("[getAllUsers]", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: String(err),
    });
  }
}

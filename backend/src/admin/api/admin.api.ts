import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { getAllUsers } from "../functions/getAllUsers";
import { updateUserRole } from "../functions/updateUserRole";
import { deleteUser } from "../functions/deleteUser";

const router = Router();

// ✅ ดึงรายชื่อผู้ใช้ทั้งหมด
router.get("/users", requireAuth, requireAdmin, getAllUsers);

// ✅ อัปเดตสิทธิ์ผู้ใช้
router.put("/users/:id/role", requireAuth, requireAdmin, updateUserRole);

// ✅ ลบผู้ใช้
router.delete("/users/:id", requireAuth, requireAdmin, deleteUser);

export default router;

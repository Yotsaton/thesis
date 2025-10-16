// src/api/admin.api.ts
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { withAuth } from "../middleware/withAuth";
import { activityLogger } from "../middleware/activityLogger";
import { getAllUsersApi } from "../admin/getAllUsers.api";
import { updateUserRoleApi } from "../admin/updateUserRole.api";
import { deleteUserApi } from "../admin/deleteUser.api";

const router = Router();

// ✅ ดึงรายชื่อผู้ใช้ทั้งหมด
router.get(
  "/users",
  requireAuth,
  activityLogger(() => ({ action: "admin_get_users" })),
  withAuth(getAllUsersApi as any)
);

// ✅ แก้ไขสิทธิ์ผู้ใช้
router.put(
  "/users/:id/role",
  requireAuth,
  activityLogger(() => ({ action: "admin_update_user_role" })),
  withAuth(updateUserRoleApi as any)
);

// ✅ ลบผู้ใช้
router.delete(
  "/users/:id",
  requireAuth,
  activityLogger(() => ({ action: "admin_delete_user" })),
  withAuth(deleteUserApi as any)
);

export default router;

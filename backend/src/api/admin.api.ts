// src/api/admin.api.ts
import { Router } from "express";
import { withAuth } from "../middleware/withAuth";
import { activityLogger } from "../middleware/activityLogger";
import { getAllUsersApi, deleteUserApi, updateUserRoleApi } from "../admin/index";
import { requireSuperUser, requireStaff } from "../middleware/requireRole";
import requireAuth from "../middleware/requireAuth";

const router = Router();

// GET /api/v1/admin/users
router.get(
  "/users",
  requireAuth,
  requireStaff,
  activityLogger(() => ({ action: "staff_get_users" })),
  withAuth(getAllUsersApi as any)
);

// PATCH /api/v1/admin/users/:username/role
router.patch(
  "/users/:username/role",
  requireAuth,
  requireSuperUser,
  activityLogger(() => ({ action: "admin_update_user_role" })),
  withAuth(updateUserRoleApi as any)
);

// DELETE /api/v1/admin/users/:username
router.delete(
  "/users/:username",
  requireAuth,
  requireSuperUser,
  activityLogger(() => ({ action: "admin_delete_user" })),
  withAuth(deleteUserApi as any)
);

export default router;

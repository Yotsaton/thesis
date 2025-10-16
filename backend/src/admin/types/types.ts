// src/admin/types/types.ts
import type { users } from "../../database/database.types";

export type UserRoleDTO = Pick<users, "username" | "is_super_user" | "is_staff_user">;

// ************* getAllUsers.ts *************
export type UserSummary = Pick<
  users,
  | "username"
  | "email"
  | "is_super_user"
  | "is_staff_user"
  | "is_verify"
  | "is_online"
  | "last_login"
  | "last_seen"
  | "created_at"
  | "is_deleted"
  | "deleted_at"
>;

export interface ListUsersOptions {
  q?: string;                              // ค้นหา username/email (ILIKE)
  role?: "super" | "staff" | "user";       // กรองบทบาท
  verify?: boolean;                        // กรองสถานะยืนยันอีเมล
  online?: boolean;                        // กรองสถานะออนไลน์
  deleted?: boolean;                       // กรองสถานะลบ (default = false -> แสดงเฉพาะไม่ถูกลบ)
  page?: number;                           // เริ่มที่ 1 (default)
  page_size?: number;                      // 1..100 (default 20)
  sort_by?: "username" | "email" | "created_at" | "last_login" | "last_seen"; // default "username"
  order?: "asc" | "desc";                  // default "asc"
}

export interface ListUsersResult {
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    sort_by: NonNullable<ListUsersOptions["sort_by"]>;
    order: NonNullable<ListUsersOptions["order"]>;
  };
  data: UserSummary[];
}

// ************* updateUserRole.ts *************
export interface DeleteUserOptions {
  hard?: boolean;   // default: false (soft delete)
}
// src/admin/types/types.api.ts
import z from "zod";

export function zodBadRequest(res: any, err: z.ZodError) {
  return res.status(400).json({
    success: false,
    error: "zod_validation_error",
    message: "Invalid input",
    details: err.issues,
  });
}

/** ---------- Utils: Zod preprocessors ---------- */
const Boolish = z.preprocess((v) => {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
  }
  return v;
}, z.boolean());

const BoolishOrNull = Boolish.nullable();

const IntFromQuery = z.preprocess((v) => {
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return v;
}, z.number().int());

/** ---------- getAllUsers Schemas ---------- */
export const getUsersQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  role: z.enum(["super", "staff", "user"]).optional(),
  verify: Boolish.optional(),
  online: Boolish.optional(),
  deleted: Boolish.optional().default(false), // default: แสดงเฉพาะยังไม่ถูกลบ
  page: IntFromQuery.optional().default(1).transform((n) => Math.max(1, n)),
  page_size: IntFromQuery.optional().default(20).transform((n) => Math.min(Math.max(1, n), 100)),
  sort_by: z.enum(["username", "email", "created_at", "last_login", "last_seen"]).optional().default("username"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});


/** ---------- updateUserRole Schemas ---------- */
export const usernameParamsSchema = z.object({
  username: z.string().min(1, "username_required").trim(),
});

export const updateUserRoleSchema = z
  .object({
    is_super_user: BoolishOrNull.optional(), // true/false = set, null/undefined = no change
    is_staff_user: BoolishOrNull.optional(),
  })
  .refine(
    (v) => typeof v.is_super_user !== "undefined" || typeof v.is_staff_user !== "undefined",
    { message: "at_least_one_role_field_required" }
  );

/** ---------- deleteUser Schemas ---------- */
// รองรับส่ง hard มาทั้ง query หรือ body; ถ้าทั้งคู่ให้ body override
export const deleteUserQuerySchema = z.object({
  hard: Boolish.optional(),
});

export const deleteUserBodySchema = z.object({
  hard: Boolish.optional(),
});

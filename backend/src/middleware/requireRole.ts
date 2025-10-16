// src/middleware/requireRole.ts
import type { Request, Response, NextFunction } from "express";
import type { Accessor } from "./type.api";

/**
 * Request ที่ถูก requireAuth เติม .auth เข้ามาแล้ว
 * หมายเหตุ: ต้องวาง requireAuth ก่อนมิดเดิลแวร์ในไฟล์นี้เสมอ
 */
export interface RequestWithAuth extends Omit<Request, 'auth'> {
  auth?: Accessor;
}

/** ---------- Helper: ส่ง JSON error มาตรฐาน ---------- */
function respondError(res: Response, status: number, code: string, message?: string) {
  return res.status(status).json({
    success: false,
    error: code,
    message: message ?? code,
  });
}

/** ---------- Guard: ตรวจว่ามี req.auth ---------- */
function getAccessorOr401(req: RequestWithAuth, res: Response): Accessor | undefined {
  const acc = req.auth;
  if (!acc) {
    respondError(res, 401, "unauthorized_no_auth", "Authentication is required");
    return;
  }
  return acc;
}

/** 
 * requireSuperUser
 * - อนุญาตเฉพาะ Super user เท่านั้น
 */
export function requireSuperUser(req: Request, res: Response, next: NextFunction) {
  const acc = getAccessorOr401(req as RequestWithAuth, res);
  if (!acc) return;

  if (!acc.is_super_user) {
    return respondError(res, 403, "forbidden_admin_only", "Super user only");
  }
  return next();
}

/** 
 * requireStaff
 * - อนุญาต Staff หรือ Super (Super ผ่านได้)
 */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const acc = getAccessorOr401(req as RequestWithAuth, res);
  if (!acc) return;

  if (!(acc.is_staff_user || acc.is_super_user)) {
    return respondError(res, 403, "forbidden_staff_only", "Staff or Super required");
  }
  return next();
}

/** 
 * requireStaffOnly
 * - อนุญาตเฉพาะ Staff เท่านั้น (Super จะไม่ผ่าน)
 * - ใช้กรณีต้องการแบ่งสิทธิ์ Staff กับ Super อย่าง “exclusionary”
 */
export function requireStaffOnly(req: Request, res: Response, next: NextFunction) {
  const acc = getAccessorOr401(req as RequestWithAuth, res);
  if (!acc) return;

  if (!acc.is_staff_user || acc.is_super_user) {
    return respondError(res, 403, "forbidden_staff_exclusive", "Staff only (not Super)");
  }
  return next();
}

/* ================= Service-layer assertions =================
 * ใช้ในฟังก์ชันเชิงธุรกิจ (service/handler ที่ไม่อยากผูกกับ Express)
 * โยน Error (ให้ไปจับข้างนอก) เพื่อคุม flow เดิมของคุณได้สะดวก
 */

/** ยืนยันว่าเป็น Super user */
export function assertAdmin(accessor?: Accessor): asserts accessor is Accessor & { is_super_user: true } {
  if (!accessor) throw new Error("unauthorized_no_auth");
  if (!accessor.is_super_user) throw new Error("forbidden_admin_only");
}

/** ยืนยันว่าเป็น Staff หรือ Super */
export function assertStaff(accessor?: Accessor): void {
  if (!accessor) throw new Error("unauthorized_no_auth");
  if (!(accessor.is_staff_user || accessor.is_super_user)) {
    throw new Error("forbidden_staff_only");
  }
}

/** ยืนยันว่าเป็น Staff “เท่านั้น” (ไม่ใช่ Super) */
export function assertStaffOnly(accessor?: Accessor): void {
  if (!accessor) throw new Error("unauthorized_no_auth");
  if (!accessor.is_staff_user || accessor.is_super_user) {
    throw new Error("forbidden_staff_exclusive");
  }
}

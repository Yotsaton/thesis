// src/activity/functions/authAudit.ts
import type { Request } from "express";
import { db } from "../../database/db-promise";
import { logActivity } from "../functions/logActivity";

/** ดึง IP ที่น่าเชื่อถือจาก req (รองรับ reverse proxy) */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const fromHeader =
    (h["cf-connecting-ip"] as string) ||
    (h["true-client-ip"] as string) ||
    (h["x-real-ip"] as string) ||
    (typeof h["x-forwarded-for"] === "string" && h["x-forwarded-for"].split(",")[0].trim()) ||
    "";

  let ip = fromHeader || req.ip || req.socket.remoteAddress || "";

  // normalize: ::ffff:a.b.c.d -> a.b.c.d
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  // normalize loopback IPv6 -> IPv4
  if (ip === "::1") ip = "127.0.0.1";

  return ip;
}

/**
 * บันทึก activity แบบปลอดภัยสำหรับ auth:
 * - เช็คก่อนว่า username มีอยู่จริง เพื่อเลี่ยง FK error
 * - ถ้าไม่เจอ -> ข้าม (หรือจะโยนไป security_log ก็ปรับที่นี่)
 */
export async function authLogSafe(
  req: Request,
  username: string | undefined | null,
  activity: string | object
): Promise<void> {
  if (!username) return; // ยังไม่มีผู้ใช้ที่ยืนยันแล้ว -> ข้าม
  const exists = await db.oneOrNone<{ username: string }>(
    `SELECT username FROM public.users WHERE username = $1 LIMIT 1`,
    [username]
  );
  if (!exists) return; // ผู้ใช้ไม่มีจริง -> ข้าม (กัน FK error)

  const ip = getClientIp(req);
  await logActivity({ username, ip_addr: ip, activity });
}

// src/activity/functions/logActivity.ts
import type { ITask, IDatabase } from "pg-promise";
import { db } from "../../database/db-promise";
import type { ActivityLogInsert } from "../types/types";

/**
 * บันทึกกิจกรรมลงตาราง activity_log
 *
 * EN:
 * Insert an activity record into public.activity_log.
 * - Safe parameterized SQL (prevents injection)
 * - Accepts plain string or object for `activity` (auto-JSON.stringify for objects)
 * - Can run with an external transaction/task or standalone
 *
 * TH:
 * - ใช้พารามิเตอร์แบบปลอดภัย
 * - รองรับ activity เป็น string หรือ object (จะแปลงเป็น JSON ให้)
 * - เรียกใช้ได้ทั้งใน transaction/task และแบบเดี่ยว
 */
export async function logActivity(
  payload: ActivityLogInsert,
  t?: ITask<any> | IDatabase<any>
): Promise<void> {
  const runner = (t as any) ?? db;

  // Coerce activity -> text
  const activityText =
    typeof payload.activity === "object"
      ? JSON.stringify(payload.activity)
      : (payload.activity ?? null);

  // หมายเหตุ: คอลัมน์ ip_addr เป็น inet;
  // สามารถส่งเป็น string IPv4/IPv6 ได้โดยตรง
  const sql = `
    INSERT INTO public.activity_log (username, ip_addr, activity)
    VALUES ($1, $2::inet, $3)
  `;

  try {
    await runner.none(sql, [payload.username, payload.ip_addr, activityText]);
  } catch (err) {
    // Best-effort logging: ไม่ throw ต่อ เพื่อไม่ให้กระทบ flow หลัก
    // ถ้าต้องการ debug ให้เปิด log นี้เฉพาะ non-production
    if (process.env.NODE_ENV !== "production") {
      console.error("[logActivity] insert failed:", err);
    }
  }
}

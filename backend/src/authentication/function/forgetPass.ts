// src/authentication/function/forgetPass.ts
import 'dotenv/config';
import { Request, Response } from 'express';
import { db } from '../../database/db-promise';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import crypto from 'crypto';

import type { users, otps } from "../../database/database.types";

// ===== ENV / Config =====
const SALT_ROUNDS = Number(process.env.BCRYPT_COST) || 10;
const RESET_TTL_MIN = Number(process.env.PASSRESET_TTL_MIN ?? 15);
const RESET_LINK_BASE = process.env.RESET_LINK_BASE || 'http://localhost:3000/reset-password';

// Email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ===== Helpers =====
function makeToken(): string {
  // base64url (ต้องใช้ Node v16+)
  return crypto.randomBytes(32).toString('base64url');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 0))}@${domain}`;
}

// ===== Schemas =====
const RequestLinkSchema = z
  .object({
    email: z.string().email().trim().transform((s) => s.toLowerCase()),
  })
  .strict();

const ConfirmResetSchema = z
  .object({
    rid: z.string().min(10).max(200).trim(),     // reset id (PK ใน otps.id)
    token: z.string().min(10).max(1000).trim(),  // token จากลิงก์ (plain)
    new_password: z.string().min(8).max(100),
  })
  .strict();

// ===== Handlers =====

/**
 * POST /password/reset/request-link
 * body: { email }
 * - ถ้า email ไม่มีในระบบ => 404 email_not_found
 * - ถ้ามี => สร้าง record ใน public.otps + ส่งอีเมลลิงก์
 */
export const requestResetLink = async (req: Request, res: Response) => {
  const parsed = RequestLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const { email } = parsed.data;

  try {
    // หา user จาก email (ระบบเก็บเป็น lower-case)
    const user = await db.oneOrNone<Pick<users, 'username' | 'email'>>(
      `SELECT username, email
         FROM public.users
        WHERE email = $1
        LIMIT 1`,
      [email]
    );

    if (!user) {
      return res.status(404).json({ error: 'email_not_found' });
    }

    // สร้าง token + hash + บันทึกใน otps
    const token = makeToken();
    const tokenHash = await bcrypt.hash(token, SALT_ROUNDS);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TTL_MIN * 60 * 1000);

    // ใช้ otps เป็นที่เก็บคำขอรีเซ็ต (แยกด้วย id)
    const rid = crypto.randomUUID();
    await db.none(
      `INSERT INTO public.otps (id, username, otp_hash, expires_at, last_resent_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [rid, user.username, tokenHash, expiresAt, now]
    );

    // สร้างลิงก์ (frontend page ที่คุณเตรียมไว้)
    const link = `${RESET_LINK_BASE}?rid=${encodeURIComponent(rid)}&token=${encodeURIComponent(token)}`;

    // ส่งอีเมล
    await transporter.sendMail({
      from: process.env.OTP_EMAIL_FROM || process.env.OTP_EMAIL_USER,
      to: user.email,
      subject: 'Reset your password',
      text:
        `คลิกลิงก์เพื่อเปลี่ยนรหัสผ่านของคุณ:\n` +
        `${link}\n\n` +
        `ลิงก์นี้จะหมดอายุใน ${RESET_TTL_MIN} นาที`,
      html:
        `<p>คลิกลิงก์เพื่อเปลี่ยนรหัสผ่านของคุณ:</p>` +
        `<p><a href="${link}">${link}</a></p>` +
        `<p>ลิงก์นี้จะหมดอายุใน ${RESET_TTL_MIN} นาที</p>`,
    });
    console.log(link); //checking
    return res.status(200).json({
      message: 'reset_link_sent',
      to: maskEmail(user.email),
      expires_in_minutes: RESET_TTL_MIN,
      rid, // เผื่อใช้ debug/dev (จะตัดออกก็ได้)
    });
  } catch (err) {
    console.error('requestResetLink error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * POST /password/reset/confirm
 * body: { rid, token, new_password }
 * - ตรวจสอบ record ใน otps โดย id (rid)
 * - เช็คหมดอายุ + เทียบ hash
 * - ตั้งรหัสผ่านใหม่, เพิ่ม token_version, ตั้ง is_online = FALSE
 * - ลบแถว otps (ใช้แล้วทิ้ง)
 */
export const confirmResetWithLink = async (req: Request, res: Response) => {
  const parsed = ConfirmResetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const { rid, token, new_password } = parsed.data;

  try {
    // หาแถวจาก rid
    const row = await db.oneOrNone<Pick<otps, 'id' | 'username' | 'otp_hash' | 'expires_at'>>(
      `SELECT id, username, otp_hash, expires_at
         FROM public.otps
        WHERE id = $1
        LIMIT 1`,
      [rid]
    );
    if (!row) {
      return res.status(400).json({ error: 'invalid_or_expired_link' });
    }

    // เช็คหมดอายุ
    const now = new Date();
    if (now > new Date(row.expires_at)) {
      await db.none(`DELETE FROM public.otps WHERE id = $1`, [row.id]);
      return res.status(400).json({ error: 'invalid_or_expired_link' });
    }

    // เทียบ token กับ hash
    const ok = await bcrypt.compare(token, row.otp_hash);
    if (!ok) {
      return res.status(400).json({ error: 'invalid_or_expired_link' });
    }

    // แฮชรหัสผ่านใหม่
    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);

    // อัปเดตรหัสผ่าน + เพิกถอนโทเค็นเดิมทั้งหมด + ออฟไลน์ และลบแถว otps
    await db.tx(async (t) => {
      await t.none(
        `UPDATE public.users
            SET password = $1,
                token_version = COALESCE(token_version, 0) + 1,
                is_online = FALSE
          WHERE username = $2`,
        [newHash, row.username]
      );
      await t.none(`DELETE FROM public.otps WHERE id = $1`, [row.id]);
    });

    return res.status(200).json({ message: 'password_reset_success' });
  } catch (err) {
    console.error('confirmResetWithLink error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

// src/user/otp.ts
import 'dotenv/config';
import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { db } from '../../database/db-promise';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import crypto from 'crypto';

import type { users, otps } from "../../database/database.types";
import { diff } from 'util';

const OTP_TTL_MIN = Number(process.env.OTP_TTL_MIN ?? 5);           // อายุ OTP (นาที)
const RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN ?? 60);
const SALT_ROUNDS = Number(process.env.BCRYPT_COST)

// ---------- Email Transporter ----------
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,   // อีเมลผู้ส่ง
    pass: process.env.EMAIL_PASS,   // App Password/SMTP password
  },
});

// ---------- Helpers ----------
function createOtp(length = 6): string {
  // โค้ด 6 หลัก (000000-999999)
  return String(crypto.randomInt(0, 1_000_000)).padStart(length, '0');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 0))}@${domain}`;
}

// ---------- Schemas ----------
const SendOtpSchema = z
  .object({
    username: z.string().min(1).max(100).trim(),
  })
  .strict();

const VerifyOtpSchema = z
  .object({
    username: z.string().min(1).max(100).trim(),
    otp: z.string().min(4).max(10).trim(),
  })
  .strict();

const ResendOtpSchema = SendOtpSchema;

// ---------- Handlers ----------
/**
 * ส่ง OTP ให้ผู้ใช้ (สร้าง/แทนที่แถวใน public.otps)
 * body: { user_name }
 */
export const sendOTP = async (req: Request, res: Response) => {
  const parsed = SendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const { username } = parsed.data;

  try {
    // 1) หาอีเมล/สถานะยืนยัน
    const user = await db.oneOrNone<Pick<users, 'username' | 'email' | 'is_verify'>>(
      `SELECT username, email, is_verify FROM public.users WHERE username = $1`,
      [username]
    );
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    // ผู้ใช้ยืนยันแล้ว ไม่ต้องออก OTP อีก
    if (user.is_verify) {
      await db.none(`DELETE FROM public.otps WHERE username = $1`, [username]);
      return res.status(409).json({ error: 'already_verified' });
    }

    // 2) ถ้ามี OTP อยู่แล้ว -> บล็อก และให้ไปใช้งาน /otp/resend
    const existing = await db.oneOrNone<Pick<otps, 'id' | 'last_resent_at' | 'expires_at'>>(
      `SELECT id, last_resent_at, expires_at
         FROM public.otps
        WHERE username = $1
        LIMIT 1`,
      [username]
    );
    if (existing) {
      const now = new Date();
      const last = new Date(existing.last_resent_at);
      const diffSec = Math.floor((now.getTime() - last.getTime()) / 1000);
      const canResendIn = Math.max(0, RESEND_COOLDOWN_SEC - diffSec);
      console.log("now" + now);
      console.log("last" + last);
      console.log("diff" + diffSec);
      
      return res.status(409).json({
        error: 'otp_already_sended',
        message: 'มี OTP สำหรับผู้ใช้นี้อยู่แล้ว ให้ใช้ /resendOTP เพื่อรับOTPอีกครั้ง',
        can_resend_in_seconds: canResendIn,
        expires_at: existing.expires_at, // เผื่อ UI ใช้บอกผู้ใช้
      });
    }

    // 3) สร้าง/เก็บ OTP (ครั้งแรกเท่านั้นถึงมาถึงตรงนี้)
    const otp = createOtp(6);
    const otpHash = await bcrypt.hash(otp, SALT_ROUNDS || 12);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MIN * 60 * 1000);

    const id = crypto.randomUUID();
    await db.none(
      `INSERT INTO public.otps (id, username, otp_hash, expires_at, last_resent_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, username, otpHash, expiresAt, now]
    );

    // 4) ส่งอีเมล
    console.log(otp) //เอาออกด้วยเอาไว้เทส
    await transporter.sendMail({
      from: process.env.OTP_EMAIL_FROM || process.env.OTP_EMAIL_USER,
      to: user.email,
      subject: 'Your OTP Code',
      text: `รหัสยืนยันของคุณคือ: ${otp}\nรหัสจะหมดอายุใน ${OTP_TTL_MIN} นาที`,
    });

    return res.status(200).json({
      message: 'otp_sent',
      to: maskEmail(user.email),
      expires_in_minutes: OTP_TTL_MIN,
    });
  } catch (err) {
    console.error('sendOTP error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * ยืนยัน OTP
 * body: { user_name, otp }
 * - ตรวจหมดอายุ
 * - เปรียบเทียบ hash
 * - อัปเดต users.is_verify = true
 * - ลบแถวใน otps
 */
export const verifyOTP = async (req: Request, res: Response) => {
  const parsed = VerifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const { username, otp } = parsed.data;

  try {
    // 1) ดึง OTP ล่าสุดของผู้ใช้ (เราลบเก่าไว้แล้ว จึงคาดว่าเหลือแถวเดียว)
    const row = await db.oneOrNone<Pick<otps, 'id' | 'username' | 'otp_hash' | 'expires_at'>>(
      `SELECT id, username, otp_hash, expires_at
         FROM public.otps
        WHERE username = $1
        ORDER BY expires_at DESC
        LIMIT 1`,
      [username]
    );

    if (!row) {
      return res.status(400).json({ error: 'otp_not_found' });
    }

    // 2) ตรวจหมดอายุ
    const now = new Date();
    if (now > new Date(row.expires_at)) {
      // ลบแถวที่หมดอายุ
      await db.none(`DELETE FROM public.otps WHERE id = $1`, [row.id]);
      return res.status(400).json({ error: 'otp_expired' });
    }

    // 3) เทียบรหัส
    const ok = await bcrypt.compare(otp, row.otp_hash);
    if (!ok) {
      return res.status(400).json({ error: 'otp_incorrect' });
    }

    // 4) อัปเดตสถานะผู้ใช้ และลบ OTP
    await db.tx(async (t) => {
      await t.none(`UPDATE public.users SET is_verify = true WHERE username = $1`, [username]);
      await t.none(`DELETE FROM public.otps WHERE id = $1`, [row.id]);
    });

    return res.status(200).json({ message: 'otp_verified' });
  } catch (err) {
    console.error('verifyOTP error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

/**
 * ขอส่ง OTP ใหม่ (Resend) โดยเคารพ cooldown ที่ last_resent_at
 * body: { user_name }
 */
export const resendOTP = async (req: Request, res: Response) => {
  const parsed = ResendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const { username } = parsed.data;

  try {
    // 1) เอาอีเมลผู้ใช้
    const user = await db.oneOrNone<Pick<users, 'username' | 'email'>>(
      `SELECT username, email FROM public.users WHERE username = $1`,
      [username]
    );
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // 2) ดูข้อมูล OTP ปัจจุบัน (ถ้ามี)
    const current = await db.oneOrNone<Pick<otps, 'id' | 'last_resent_at'>>(
      `SELECT id, last_resent_at
         FROM public.otps
        WHERE username = $1
        LIMIT 1`,
      [username]
    );

    const now = new Date();
    if (current) {
      const last = current.last_resent_at;
      const diffSec = Math.floor((now.getTime() - last.getTime()) / 1000);
      console.log("now"+ now);
      console.log("last"+ last);
      console.log("diff"+ diffSec);
      
      if (diffSec < RESEND_COOLDOWN_SEC) {
        return res.status(429).json({
          error: 'resend_too_soon',
          retry_after_seconds: RESEND_COOLDOWN_SEC - diffSec,
        });
      }
    }

    // 3) สร้าง OTP ใหม่
    const otp = createOtp(6);
    const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MIN * 60 * 1000);

    if (current) {
      // อัปเดตแถวเดิม
      await db.none(
        `UPDATE public.otps
            SET otp_hash = $1, expires_at = $2, last_resent_at = $3
          WHERE id = $4`,
        [otpHash, expiresAt, now, current.id]
      );
    } else {
      // ไม่มีแถวเดิม — แทรกใหม่
      const id = crypto.randomUUID();
      await db.none(
        `INSERT INTO public.otps (id, username, otp_hash, expires_at, last_resent_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, username, otpHash, expiresAt, now]
      );
    }

    // 4) ส่งอีเมล
    console.log("otp : "+otp)
    await transporter.sendMail({
      from: process.env.OTP_EMAIL_FROM || process.env.OTP_EMAIL_USER,
      to: user.email,
      subject: 'Your OTP Code',
      text: `รหัสยืนยันของคุณคือ: ${otp}\nรหัสจะหมดอายุใน ${OTP_TTL_MIN} นาที`,
    });

    return res.status(200).json({
      message: 'otp_resent',
      to: maskEmail(user.email),
      expires_in_minutes: OTP_TTL_MIN,
      cooldown_seconds: RESEND_COOLDOWN_SEC,
    });
  } catch (err) {
    console.error('resendOTP error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

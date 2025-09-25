// src/authentication/function/register.ts
import "dotenv/config";
import { Request, Response } from 'express';
import { db } from '../../database/db-promise'; // pg-promise instance
import bcrypt from 'bcrypt';
import { success, z } from 'zod';
import type {users} from "../../database/database.types"
import type {users_insert_params} from "../types/types"
import {sendOTP}from "./otp"

const SALT_ROUNDS = Number(process.env.BCRYPT_COST)
type users_public = Omit<users, "password">;

/** Zod schema: whitelist ฟิลด์, validate, และ normalize email ให้เป็น lower-case */
const RegisterSchema = z
  .object({
    username: z.string().min(3).max(50).trim(),
    email: z.string().email().trim().transform((s) => s.toLowerCase()),
    password: z.string().min(8).max(100),
  })
  .strict(); // ปฏิเสธคีย์ที่ไม่ได้ประกาศ

export const registerUser = async (req: Request, res: Response) => {
  // 1) Validate + sanitize input
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'invalid_input',
      details: parsed.error.flatten(),
    });
  }
  const { username, email, password } = parsed.data;

  try {
    // 2) ตรวจสอบซ้ำทั้ง username (PK) และ email
    const dup = await db.oneOrNone<Pick<users, 'username' | 'email'>>(
      `SELECT username, email
         FROM public.users
        WHERE username = $1 OR email = $2`,
      [username, email]
    );
    if (dup) {
      if (dup.username === username) {
        return res.status(409).json({
          error: 'username นี้ถูกใช้งานแล้ว',
          success: false,
        });
      }
      if (dup.email.toLowerCase() === email) {
        return res.status(409).json({ 
          error: 'อีเมลนี้ถูกลงทะเบียนแล้ว',
          success: false,
        });
      }
    }

    // 3) เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 4) เตรียมข้อมูล insert ตาม users_insert_params (whitelist ชัดเจน)
    const insertData: users_insert_params = {
      username: username,
      email : email,
      password: hashedPassword,
      is_verify: false,
      is_online: false,
      last_login: null,
    };

    // 5) INSERT แล้วอ่านค่าที่จำเป็น (คืนค่า RAW จาก DB เป็น string ของ timestamp)
    const inserted = await db.one< users >(
      `INSERT INTO public.users
               (username, email, password, is_verify, is_online, last_login)
        VALUES ($1,       $2,    $3,       $4,        $5,        $6)
        RETURNING username, email, is_super_user, is_staff_user, created_at, is_verify, is_online, last_login, token_version, last_seen`,
      [
        insertData.username,
        insertData.email,
        insertData.password,
        insertData.is_verify ?? false,
        insertData.is_online ?? false,
        insertData.last_login ?? null,
      ]
    );

    // 6) map เป็น users_public (Date objects) ให้ตรงกับ type ของคุณ
    const newUser: users_public = {
      username: inserted.username,
      email: inserted.email,
      is_super_user: inserted.is_super_user,
      is_staff_user: inserted.is_staff_user,
      created_at: inserted.created_at,
      is_verify: inserted.is_verify,
      is_online: inserted.is_online,
      last_login: inserted.last_login,
      token_version: inserted.token_version,
      last_seen : inserted.last_seen,
    };

    // 7) ตอบกลับ 
    console.log(newUser);
    const resultotp = sendOTP(newUser.username);
    return res.status(201).json({
      message: 'ลงทะเบียนสำเร็จ',
      success: true,
      resultotp
    });
  } catch (err: any) {
    // กันกรณีชน PK ซ้ำ (race condition)
    if (err?.code === '23505') {
      return res.status(409).json({ 
        error: 'username นี้ถูกใช้งานแล้ว',
        success: false, 
      });
    }
    console.error('Registration Error:', err);
    return res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดภายในระบบ',
      success: false,
    });
  }
};

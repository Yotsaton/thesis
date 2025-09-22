// src/authentication/function/changePass.ts
import 'dotenv/config';
import { Request, Response } from 'express';
import { db } from '../../database/db-promise';
import bcrypt from 'bcrypt';
import { z } from 'zod';

import type { users } from "../../database/database.types";

const SALT_ROUNDS = Number(process.env.BCRYPT_COST) || 12;

const ChangePasswordSchema = z.object({
  old_password: z.string().min(8).max(100),
  new_password: z.string().min(8).max(100),
}).strict();

export const changePassword = async (req: Request, res: Response) => {
  // ต้องผ่าน requireAuth มาก่อน และมี req.auth.sub = user_name
  const auth = (req as any).auth as { username?: string } | undefined;
  if (!auth?.username) return res.status(401).json({ error: 'unauthorized' });

  // validate body
  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const { old_password, new_password } = parsed.data;

  if (old_password === new_password) {
    return res.status(400).json({ error: 'password_not_changed' });
  }

  try {
    // ดึงรหัสผ่านปัจจุบัน
    const row = await db.oneOrNone<Pick<users, 'password' | 'username' | 'token_version'>>(
      `SELECT password, username, COALESCE(token_version, 0) AS token_version
         FROM public.users
        WHERE username = $1`,
      [auth.username]
    );
    if (!row) return res.status(404).json({ error: 'user_not_found' });

    // ตรวจ old_password
    const ok = await bcrypt.compare(old_password, row.password);
    if (!ok) return res.status(400).json({ error: 'old_password_incorrect' });

    // แฮชรหัสผ่านใหม่
    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);

    // อัปเดต: ตั้งรหัสใหม่ + revoke tokens ทั้งหมด + ออฟไลน์
    await db.none(
      `UPDATE public.users
          SET password = $1,
              token_version = COALESCE(token_version, 0) + 1,
              is_online = FALSE
        WHERE username = $2`,
      [newHash, row.username]
    );

    // หลังจากนี้ token ปัจจุบันของผู้ใช้จะใช้ต่อไม่ได้ (เพราะ ver ไม่ตรง)
    return res.status(200).json({ message: 'password_changed', relogin_required: true });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

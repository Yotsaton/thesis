// src/user/function/logout.ts
import { Request, Response } from 'express';
import { db } from '../../database/db-promise';

type AuthPayload = { username: string } | undefined;

export const logout = async (req: Request, res: Response) => {
  const auth = (req as any).auth as AuthPayload;
  if (!auth?.username) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    // เพิ่ม token_version +1 และเซ็ตออฟไลน์
    const rowCount = await db.result(
      `UPDATE public.users
          SET is_online    = FALSE,
              token_version = token_version + 1
        WHERE username = $1`,
      [auth.username],
      r => r.rowCount
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // ฝั่ง client ควรลบทิ้ง token ปัจจุบันทันที (localStorage / cookie)
    return res.status(200).json({
      message: 'logout_success',
      revoked_all_tokens: true
    });
  } catch (err) {
    console.error('logout error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

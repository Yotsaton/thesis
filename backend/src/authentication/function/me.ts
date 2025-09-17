// src/user/me.ts
import { Request, Response } from 'express';
import { db } from '../../database/db-promise';
import type { users } from '../../database/database.types';

type users_public = Omit<users, "password">;

export const me = async (req: Request, res: Response) => {
  const auth = (req as any).auth as { username: string } | undefined;
  if (!auth?.username) return res.status(401).json({ error: 'unauthorized' });

  try {
    // ใช้ Pick<users,...> จากไฟล์ types
    const user = await db.oneOrNone<users_public>(
      `SELECT username, email, is_super_user, is_staff_user, created_at,
       is_verify, is_online, last_login, 'token_version', 'last_seen'
         FROM public.users
        WHERE username = $1`,
      [auth.username]
    );

    if (!user) return res.status(404).json({ error: 'user_not_found' });

    return res.json({ user });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

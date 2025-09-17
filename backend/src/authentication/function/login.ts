// src/authentication/function/login.ts
import 'dotenv/config';
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { uuid, z } from 'zod';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid';
import { db } from "../../database/db-promise";
import type { users } from "../../database/database.types";

const JWT_ACCESS_SECRET : Secret = process.env.JWT_ACCESS_SECRET as Secret;
const accessTokenTTL: SignOptions = {
  expiresIn: (process.env.ACCESS_TOKEN_TTL ?? "1h") as unknown as SignOptions["expiresIn"],
} satisfies SignOptions;

const ACCESS_COOKIE = "access_token";
const baseCookie = {
  httpOnly: true,
  sameSite: "none" as const, //"lax" as const,
  secure: true
  //secure: process.env.COOKIE_SECURE === "true",
  //domain: process.env.COOKIE_DOMAIN || "localhost"
};
const accessCookieOpts  = { ...baseCookie, maxAge: 1000 * 60 * 60 * 1 };

const LoginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
})
.strict();

/**
 * POST /api/v1/auth/login
 * - ตรวจ credentials + ตรวจว่า verify อีเมลแล้ว
 * - ออก access token ในคุกกี้
 */
export async function login(req: Request, res: Response) {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_input',
      details: parsed.error.flatten(),
    });
  };
  const {usernameOrEmail, password} = parsed.data;

  // 1) ดึงข้อมูล user
  const user = await db.oneOrNone<users>(
    `SELECT * FROM public.users WHERE username = $1 OR email = $1`,
    [usernameOrEmail]
  );
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  if (!user.is_verify) return res.status(403).json({ error: "user not verified" });

  // 2) ตรวจ password
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "invalid credentials" });
  
  // 3) อัพเดท user table
  await db.none(
    `UPDATE public.users
     SET is_online = true, last_login = now(), last_seen = now()
     WHERE username = $1`,
    [user.username]
  );

  // 4) ออก token
  console.log(JWT_ACCESS_SECRET);
  const access  = jwt.sign({ 
      sub : user.username,
      ver : user.token_version,
      jti : uuidv4(),
      is_super_user : user.is_super_user ?? false,
      is_staff_user : user.is_staff_user ?? false,
    },
    JWT_ACCESS_SECRET,
    accessTokenTTL);

  res
    .cookie(ACCESS_COOKIE, access, accessCookieOpts)
    .json({ message: "logged in" });
}

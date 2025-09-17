// src/middleware/requireAuth.ts
import "dotenv/config";
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload, type Secret } from "jsonwebtoken";
import { db } from "../database/db-promise";

const ACCESS_COOKIE = "access_token";
const JWT_ACCESS_SECRET: Secret = process.env.JWT_ACCESS_SECRET as Secret;

export type AccessPayload = JwtPayload & {
  sub: string;
  ver?: number;
  jti?: string;
  is_super_user?: boolean;
  is_staff_user?: boolean;
};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        username: string;
        is_super_user: boolean;
        is_staff_user: boolean;
        jti?: string;
        exp?: number;
        iat?: number;
      };
    }
  }
}


function extractToken(req: Request): string | null {

  const auth = req.headers.authorization;
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const cookieToken = (req as any).cookies?.[ACCESS_COOKIE];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "missing_token" });
    }

    let payload: AccessPayload;
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      if (typeof decoded === "string") {
        return res.status(401).json({ error: "invalid_token_payload" });
      }
      payload = decoded as AccessPayload;
    } catch (err: any) {
      if (err && err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "token_expired" });
      }
      console.error("[requireAuth] verify_error:", err?.name, err?.message);
      return res.status(401).json({ error: "invalid_token" });
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return res.status(401).json({ error: "invalid_subject" });
    }

    // Tolerant global revoke logic:
    // - Treat null/undefined DB values as 0
    // - Only revoke if DB version is strictly greater than token's version (meaning a forced logout happened AFTER token was issued).
    if (payload.ver !== undefined) {
      try {
        const row = await db.oneOrNone<{ token_version: number | null }>(
          `SELECT token_version FROM public.users WHERE username = $1`,
          [payload.sub]
        );
        if (!row) {
          return res.status(401).json({ error: "user_not_found" });
        }
        const dbVer = Number(row.token_version ?? 0);
        const tokVer = Number(payload.ver ?? 0);
        if (Number.isNaN(dbVer) || Number.isNaN(tokVer)) {
          console.error("[requireAuth] bad_version_numbers:", { dbVer, tokVer });
          return res.status(401).json({ error: "auth_check_failed" });
        }
        // Revoke only when DB version is *greater* than token version.
        if (dbVer > tokVer) {
          return res.status(401).json({ error: "token_revoked" });
        }
      } catch (e) {
        console.error("[requireAuth] db_check_error:", e);
        return res.status(401).json({ error: "auth_check_failed" });
      }
    }

    req.auth = {
      username: payload.sub,
      is_super_user: Boolean(payload.is_super_user),
      is_staff_user: Boolean(payload.is_staff_user),
      jti: payload.jti,
      exp: payload.exp,
      iat: payload.iat,
    };

    return next();
  } catch (e) {
    console.error("[requireAuth] fatal_error:", e);
    return res.status(401).json({ error: "unauthorized" });
  }
}

export default requireAuth;

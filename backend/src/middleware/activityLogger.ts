// src/activity/middleware/activityLogger.ts
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logActivity } from "../activity/functions/logActivity";

type ActivityInput =
  | string
  | ((req: Request, res: Response) => string | object | undefined);

interface IncludeOptions {
  jti?: boolean;
  ua?: boolean;
  path?: boolean;
  method?: boolean;
  bodyKeys?: boolean; // บันทึกเฉพาะชื่อคีย์ใน body เพื่อเลี่ยงข้อมูลละเอียด
}

interface LoggerOptions {
  include?: IncludeOptions;
  // ใช้ redact เพื่อลดทอน/ซ่อนข้อมูลบางอย่าง (เช่น ตัด length ของ UA)
  redact?: (data: Record<string, unknown>) => Record<string, unknown>;
  // บันทึกหลังส่ง response เสร็จ (เฉพาะสำเร็จ) แทนที่จะเป็นก่อน
  onFinishOnly?: boolean;
}

export function activityLogger(
  activity?: ActivityInput,
  getUsername: (req: Request) => string | undefined = (req) =>
    (req as any).auth?.username,
  opts: LoggerOptions = {}
): RequestHandler {
  const include = opts.include ?? {};

  const buildPayload = (req: Request, res: Response) => {
    const activityResult = typeof activity === "function" ? activity(req, res) : activity;
    const base: Record<string, unknown> = 
      typeof activityResult === "string" 
        ? { message: activityResult }
        : (activityResult ?? {}) as Record<string, unknown>;
    const extra: Record<string, unknown> = {};

    if (include.jti) extra.jti = (req as any).auth?.jti;
    if (include.ua) extra.ua = req.headers["user-agent"];
    if (include.path) extra.path = req.path;
    if (include.method) extra.method = req.method;
    if (include.bodyKeys) extra.bodyKeys = Object.keys(req.body ?? {});

    const merged = { ...base, ...extra };
    return opts.redact ? opts.redact(merged) : merged;
  };

  const handler: RequestHandler = (req, res, next) => {
    const username = getUsername(req);
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      "";

    if (!username || !ip) return next();

    const doLog = () =>
      logActivity({
        username,
        ip_addr: ip,
        activity: buildPayload(req, res),
      });

    if (opts.onFinishOnly) {
      res.on("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          void doLog();
        }
      });
      return next();
    }

    // บันทึกก่อน (ง่ายและเร็ว)
    void doLog();
    next();
  };

  return handler;
}

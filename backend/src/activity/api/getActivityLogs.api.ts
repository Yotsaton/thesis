// src/activity/api/getActivityLogs.api.ts
import type { Request, Response } from "express";
import { getActivityLogsAuthorized } from "../functions/getActivityLogs";
import {QuerySchema} from '../types/types.api'

/** GET /activity/logs */
export async function getActivityLogsApi(req: Request, res: Response) {
  try {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "bad_query", detail: parsed.error.issues });
    }

    const q = parsed.data;
    const accessor = (req as any).auth as {
      username: string;
      is_super_user?: boolean;
      is_staff_user?: boolean;
    };

    const result = await getActivityLogsAuthorized(
      accessor,
      {
        username: q.username,
        ip: q.ip,
        activitySearch: q.q,
        timeFrom: q.from,
        timeTo: q.to,
        limit: q.limit ?? 50,
        cursorId: q.cursor,
        sortAsc: q.asc === 1,
      }
    );

    return res.json({ success: true, ...result });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[getActivityLogsApi] failed:", e);
    }
    return res.status(500).json({ success: false, error: "unexpected_error" });
  }
}

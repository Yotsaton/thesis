// src/trip/types/api.type.ts
import { type Request } from "express";
import { Accessor } from "./type";
import z from "zod"

export type AuthenticatedRequest = Request & { auth: Accessor };

/**
 * POST /api/v1/trips
 * สร้างทริปใหม่ของผู้ใช้ที่ล็อกอินอยู่
 * Body:
 *  - header?: string | null
 *  - start_plan: string|Date (YYYY-MM-DD หรือ Date)
 *  - end_plan:   string|Date (YYYY-MM-DD หรือ Date)
 */
export const CreateTripBody = z.object({
  header: z.string().trim().min(1).nullable().optional().or(z.literal("").transform(() => null)),
  start_plan: z.union([z.string().min(4), z.date()]),
  end_plan: z.union([z.string().min(4), z.date()]),
});

// ชนิดคอลัมน์ที่อนุญาตให้ sort (ให้ตรงกับ union type ใน ListTripsOptions)
const SortEnum = z.enum(["start_plan", "created_at", "updated_at"]);
const DirEnum = z.enum(["asc", "desc"]);

// YYYY-MM-DD validator (เก็บเป็น string เพื่อส่งต่อให้ DB layer)
const DateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const ListQuerySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    from: DateStr.optional(),
    to: DateStr.optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),

    // สำหรับ admin ค้นหาโดย username (รองรับ "alice,bob")
    username: z.string().trim().min(1).optional(),

    // รับ "col:dir" เช่น "created_at:desc"
    sort: z.string().trim().default("created_at:desc"),
  })
  .transform(({ sort, page, page_size, username, ...rest }) => {
    const [colRaw, dirRaw] = (sort || "").split(":");
    const orderBy = SortEnum.safeParse((colRaw || "").trim()).success
      ? (colRaw as z.infer<typeof SortEnum>)
      : "created_at";
    const direction = DirEnum.safeParse((dirRaw || "desc").toLowerCase()).success
      ? (dirRaw.toLowerCase() as z.infer<typeof DirEnum>)
      : "desc";

    const limit = page_size;
    const offset = (page - 1) * page_size;

    // map username (string) -> usernames (string[])
    const usernames =
      typeof username === "string" && username.length > 0
        ? username.split(",").map(s => s.trim()).filter(Boolean)
        : undefined;

    return {
      ...rest,
      page,
      page_size,
      orderBy,
      direction,
      limit,
      offset,
      usernames, // ← ส่งต่อให้ handler/DAO
    };
  });

export type ListQueryParsed = z.infer<typeof ListQuerySchema>;


// src/trip/types/api.type.ts
import { type Request } from "express";
import { Accessor } from "./type";
import z from "zod"

export type AuthenticatedRequest = Request & { auth: Accessor };

/**
 * POST /api/v1/auth/trips
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

/** ต้องการ timestamp ที่เป็น ISO 8601 (RFC3339) เช่น 2025-09-25T12:34:56.789Z หรือมี offset */
const ISODateTime = z
  .string()
  .refine(
    (s) => !Number.isNaN(Date.parse(s)),
    "updated_at must be a valid ISO 8601 timestamp"
  );

export const ParamSchema = z.object({
  trip_id: z.string().min(1, "trip_id is required"),
});

export const UpdateBodySchema = z
  .object({
    // ----- UpdateOptions (REQUIRED) -----
    updated_at: ISODateTime, // ใช้เพื่อ optimistic concurrency และแมปเป็น ifMatchUpdatedAt ตอนเรียก service

    // ----- Fields to update (partial) -----
    header: z
      .union([z.string().trim().min(1), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" ? null : v ?? undefined)),
    status: z.string().trim().min(1).optional(),
    start_plan: DateStr.optional(),
    end_plan: DateStr.optional(),
  })
  .refine(
    (data) =>
      data.header !== undefined ||
      data.status !== undefined ||
      data.start_plan !== undefined ||
      data.end_plan !== undefined,
    { message: "At least one field (header, status, start_plan, end_plan) is required" }
  )
  .refine(
    (data) =>
      !(data.start_plan && data.end_plan) || data.end_plan >= data.start_plan,
    { message: "end_plan must be >= start_plan when both are provided" }
  );

// รับ updated_at (ISO 8601) ไว้ใช้เป็น if-match (ถ้าคุณรองรับ concurrency ตอนลบ)
export const DeleteBodySchema = z.object({
  updated_at: z
    .string()
    .refine((v) => (v ? !Number.isNaN(Date.parse(v)) : true), "updated_at must be ISO 8601"),
});
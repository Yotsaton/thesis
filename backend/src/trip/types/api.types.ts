// src/trip/types/api.type.ts
import z from "zod"

/** ---------- Params Schema ---------- */
export const ParamSchema = z.object({
  trip_id: z.string().min(1, "trip_id is required"),
});

/** ---------- Item Schemas ---------- */
const PlaceItemSchema = z.object({
  type: z.literal("place"),
  id: z.string().nullable().optional(),          // route.id (DB) ถ้ามีตอน update
  place_id: z.string().optional(),    // Google place_id (ใช้ resolve -> place.id DB)
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.any().optional(),       // geoJSONPoint (ปล่อยหลวมฝั่ง API)
  name: z.string().optional(),
}).strip();

const NoteItemSchema = z.object({
  type: z.literal("note"),
  id: z.string().nullable().optional(),          // route.id (DB) ถ้ามีตอน update
  text: z.string().optional(),
}).strip();

const ItemSchema = z.union([PlaceItemSchema, NoteItemSchema]);

/** ---------- Day Schema: รับ color ได้ แต่ตัดทิ้ง ---------- */
const DayInputSchema = z.object({
  id: z.string().nullable().optional(),
  date: z.string().min(1),
  subheading: z.string().optional(),
  updatedAt: z.any().optional(),
  color: z.string().optional(),       // << รับมาได้จาก FE
  items: z.array(ItemSchema),
}).strip();

// หลัง transform: object ที่ได้จะ "ไม่มี color"
const DaySchema = DayInputSchema.transform(({ color, ...rest }) => rest);

/** ---------- Trip (Create/PUT Deep) ---------- */
export const TripPayloadSchema = z.object({
  name: z.string().optional(),
  start_plan: z.string().min(1, "start_plan is required"),
  end_plan: z.string().min(1, "end_plan is required"),
  days: z.array(DaySchema),
}).strip();

export type TripPayload = z.infer<typeof TripPayloadSchema>;

/** ---------- List Query Schema ---------- */

// ชนิดคอลัมน์ที่อนุญาตให้ sort (ให้ตรงกับ union type ใน ListTripsOptions)
const SortEnum = z.enum(["start_plan", "created_at", "updated_at"]);
const DirEnum = z.enum(["asc", "desc"]);

// YYYY-MM-DD validator (เก็บเป็น string เพื่อส่งต่อให้ DB layer)
const DateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const StatusEnum = z.enum(["active", "deleted"]);

export const ListQuerySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    status: StatusEnum.optional().default("active"),
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

// ---------- DELETE Body Schema (สำหรับ optimistic concurrency) ----------
export const DeleteBodySchema = z.object({
  updated_at: z
    .string()
    .refine((v) => (v ? !Number.isNaN(Date.parse(v)) : true), "updated_at must be ISO 8601"),
});
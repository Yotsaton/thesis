// src/recomment/types/types.api.ts
import {z} from "zod";

/** สคีมารับพารามิเตอร์ (เน้น POST body แต่รองรับ query ได้ด้วย) */
export const RecommentParamsSchema = z.object({
  provinces: z.array(z.string().min(1)).min(1, "ต้องระบุอย่างน้อย 1 จังหวัด"),
  categories: z.array(z.string().min(1)).default(["tourist_attraction"]),
  limit: z.number().int().min(1).max(50).default(30),
});

export type RecommentParams = z.infer<typeof RecommentParamsSchema>;
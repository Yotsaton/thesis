// src/place/types/types.api.ts

import { z } from "zod";
/** Zod schema: geoJSON Point */
const GeoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]), // [lon, lat]
});

/** Zod schema: ResolveInput – อย่างน้อยต้องมี place_id_by_ggm หรือ location */
export const ResolveInputSchema = z
  .object({
    place_id: z.string().min(1).optional(),
    location: GeoPointSchema.optional(),
  })
  .refine(
    (o) => Boolean(o.place_id) || Boolean(o.location),
    "ต้องส่ง place_id หรือ location อย่างน้อย 1 ฟิลด์",
  );

export type ResolveInputDTO = z.infer<typeof ResolveInputSchema>;
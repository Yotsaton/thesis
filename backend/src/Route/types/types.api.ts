// .src/Route/types/types.api.ts
import { z } from "zod";

/** Zod schema: GeoJSON Point [lon, lat] */
const GeoJSONPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z
    .tuple([
      z.number().refine((lon) => lon >= -180 && lon <= 180, "longitude out of range"),
      z.number().refine((lat) => lat >= -90 && lat <= 90, "latitude out of range"),
    ])
    .describe("[longitude, latitude]"),
});

/** Zod schema: Request body */
export const GetRouteBodySchema = z.object({
  origin: GeoJSONPointSchema,
  destination: GeoJSONPointSchema,
  waypoint: z.array(GeoJSONPointSchema).optional().default([]),
});

export type GetRouteBody = z.infer<typeof GetRouteBodySchema>;

/** Zod schema: PlaceItem (บังคับให้มี location สำหรับทุก item) */
const PlaceItemSchema = z.object({
  type: z.literal("place"),
  id: z.string().nullable(),
  place_id: z.string().optional(),
  location: GeoJSONPointSchema, // <-- require
  name: z.string().optional(),
  startTime: z.string().optional(), // 'HH:mm'
  endTime: z.string().optional(),   // 'HH:mm'
});

/** Body schema: รับเป็นอาร์เรย์ PlaceItem[] */
export const GetTSPWithRouteBody = z.object({
  places: z.array(PlaceItemSchema).min(2, "At least start and end places are required"),
});
export type GetTSPWithRouteBody = z.infer<typeof GetTSPWithRouteBody>;
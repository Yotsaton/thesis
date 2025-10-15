// src/recomment/functions/recommentFromProvince.ts

import { db } from "../../database/db-promise";
import type { PlaceRecommendation } from "../types/types";
import { mapPlaceRecommendationsCategoriesThai } from "./mappingCategory";

/**
 * หมวดหมู่ที่ถือว่าเกี่ยวกับการท่องเที่ยว (whitelist)
 * - ใช้สำหรับกรอง categories จากฐานข้อมูลให้เหลือเฉพาะที่เกี่ยวกับ "เที่ยว"
 */
const TOURISM_TYPES: ReadonlySet<string> = new Set([
  "tourist_attraction",     "point_of_interest",
  "museum",                 "art_gallery",
  "park",                   "national_park",
  "botanical_garden",       "zoo",
  "aquarium",               "amusement_park",
  "theme_park",             "campground",
  "hiking_area",            "landmark",
  "historical_landmark",    "historical_place",
  "monument",               "palace",
  "castle",                 "temple",
  "buddhist_temple",        "place_of_worship",
  "church",                 "mosque",
  "synagogue",              "shrine",
  "viewpoint",              "scenic_point",
  "natural_feature",        "beach",
  "waterfall",              "island",
  "mountain",               "market",
  "floating_market",
]);

/** normalize คำ (ลดรูป/ช่องว่าง) เพื่อให้เทียบกับ whitelist ได้ง่าย */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "_");

/**
 * สร้างเงื่อนไข WHERE สำหรับจังหวัด (address ILIKE ANY)
 */
function buildProvinceFilter(provinces: string[], values: any[]) {
  const patterns = (provinces ?? [])
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .map((p) => `%${p}%`);

  if (patterns.length === 0) return { sql: "", values };

  values.push(patterns);
  const sql = `address ILIKE ANY($${values.length})`;
  return { sql, values };
}

/**
 * กรอง categories ที่ผู้ใช้ส่งมาให้เหลือเฉพาะหมวดเที่ยว (ตาม whitelist)
 * - ถ้าไม่เหลือเลย จะ fallback เป็น ["tourist_attraction"]
 */
function sanitizeRequestedCategories(categories: string[]): string[] {
  const clean = (categories ?? [])
    .map((c) => norm(c))
    .filter(Boolean)
    .filter((c) => TOURISM_TYPES.has(c));

  return clean.length > 0 ? clean : ["tourist_attraction"];
}

/**
 * ดึงสถานที่ท่องเที่ยวตามจังหวัด + หมวดหมู่ (กรองเป็นเที่ยวเท่านั้น)
 * - คืนค่า PlaceRecommendation[] ที่ category ถูกแปลงเป็นป้ายไทยแล้ว
 *
 * @param provinces รายชื่อจังหวัดภาษาไทย เช่น ["เชียงใหม่", "เชียงราย"]
 * @param categories รายชื่อหมวดหมู่ (อังกฤษ เช่น ["place_of_worship", "park"])
 * @param limit จำนวนสูงสุด (default 30)
 */
export async function recommentFromProvince(
  provinces: string[],
  categories: string[] = ["tourist_attraction"],
  limit: number = 30
): Promise<PlaceRecommendation[]> {
  // provinces filter
  const whereParts: string[] = [];
  const values: any[] = [];

  const prov = buildProvinceFilter(provinces, values);
  if (prov.sql) whereParts.push(prov.sql);

  // category filter (เที่ยวเท่านั้น)
  const finalCategories = sanitizeRequestedCategories(categories);
  values.push(finalCategories);
  whereParts.push(`category && $${values.length}::varchar[]`);

  const whereSQL = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const sql = `
    SELECT
      id,
      place_id_by_ggm AS place_id,
      name_place,
      address,
      category,
      rating,
      user_rating_total,
      url,
      sumary_place
    FROM public.place
    ${whereSQL}
    ORDER BY COALESCE(user_rating_total, 0) DESC, COALESCE(rating, 0) DESC NULLS LAST
    LIMIT $${values.length + 1}
  `;
  values.push(limit);

  const rows = await db.manyOrNone(sql, values);

  // map เป็น PlaceRecommendation (ดิบ)
  const raw: PlaceRecommendation[] = (rows || []).map((r: any) => ({
    id: String(r.id),
    place_id: String(r.place_id),
    name: r.name_place ?? null,
    address: r.address ?? null,
    categories: Array.isArray(r.category) ? r.category : [],
    rating: r.rating ?? null,
    rating_count: r.user_rating_total ?? null,
    url: r.url ?? null,
    detail: r.sumary_place ?? null,
  }));

  // แปลง categories → ป้ายไทย (วัด/มัสยิด/โบสถ์/ตลาด/สวน ฯลฯ)
  return mapPlaceRecommendationsCategoriesThai(raw);
}

/**
 * ฟังก์ชัน helper: เน้น “เลือกหลายจังหวัดและหลายหมวด” แบบชัดเจน
 * - เทียบเท่า recommentFromProvince แต่ตั้งชื่อให้อ่านเจตนาได้ง่าย
 */
export async function recommendByProvinceAndCategory(
  provinces: string[],
  categories: string[] = ["tourist_attraction"],
  limit: number = 30
): Promise<PlaceRecommendation[]> {
  return recommentFromProvince(provinces, categories, limit);
}

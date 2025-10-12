// src/recomment/functions/mappingCategory.ts
import type { PlaceRecommendation } from "../types/types";

/**
 * แปลง category (อังกฤษ/แบบ Google) ให้เป็น "ป้ายภาษาไทย" ที่อ่านง่าย
 * - รองรับทั้งแบบมีขีดล่าง/มีเว้นวรรค (เช่น "place of worship" -> "place_of_worship")
 * - รวมกลุ่มประเภทท่องเที่ยวที่พบบ่อย
 * - กรณีศาสนสถาน: แมปละเอียดเป็น วัด / มัสยิด / โบสถ์ / ศาลเจ้า / ธรรมศาลา(ยิว)
 * - มี heuristic จากชื่อสถานที่สำหรับเคส "place_of_worship"
 */

const normalizeKey = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, "_");

/** แปลงตรงตัว → ป้ายไทย (กรณีรู้ชนิดเจาะจงแน่นอน) */
const DIRECT_MAP: Record<string, string> = {
  // ศาสนสถาน (ระบุชัด)
  buddhist_temple: "วัด",
  temple: "วัด",
  mosque: "มัสยิด",
  church: "โบสถ์ (คริสต์)",
  shrine: "ศาลเจ้า",
  synagogue: "ธรรมศาลา (ยิว)",

  // ธรรมชาติ/แลนด์มาร์ก
  park: "สวนสาธารณะ",
  national_park: "อุทยานแห่งชาติ",
  botanical_garden: "สวนพฤกษศาสตร์",
  zoo: "สวนสัตว์",
  aquarium: "พิพิธภัณฑ์สัตว์น้ำ",
  beach: "ชายหาด",
  waterfall: "น้ำตก",
  island: "เกาะ",
  mountain: "ภูเขา/ดอย",
  viewpoint: "จุดชมวิว",
  scenic_point: "จุดชมวิว",
  natural_feature: "ธรรมชาติ",

  // พิพิธภัณฑ์/ศิลปะ
  museum: "พิพิธภัณฑ์",
  art_gallery: "แกลเลอรี",

  // สวนสนุก/กิจกรรม
  amusement_park: "สวนสนุก",
  theme_park: "สวนสนุก",
  campground: "ลานกางเต็นท์",
  hiking_area: "เส้นทางเดินป่า",

  // ตลาด/ช้อปปิ้ง
  market: "ตลาด",
  floating_market: "ตลาดน้ำ",

  // แลนด์มาร์ก/ประวัติศาสตร์
  landmark: "แลนด์มาร์ก",
  historical_landmark: "โบราณสถาน",
  historical_place: "โบราณสถาน",
  monument: "อนุสาวรีย์",
  palace: "พระราชวัง",
  castle: "ปราสาท",

};

/** คำหลัก (ไทย/อังกฤษ) ไว้เดา “place_of_worship” */
const WORSHIP_NAME_HINTS: Array<{ re: RegExp; label: string }> = [
  // วัด
  { re: /\bwat\b/i, label: "วัด" },
  { re: /(^|\s)วัด/i, label: "วัด" },
  // มัสยิด
  { re: /masjid/i, label: "มัสยิด" },
  { re: /มัสยิด/i, label: "มัสยิด" },
  // โบสถ์คริสต์ / church, cathedral
  { re: /church|cathedral/i, label: "โบสถ์ (คริสต์)" },
  { re: /โบสถ์/i, label: "โบสถ์ (คริสต์)" },
  // ศาลเจ้า / shrine
  { re: /shrine/i, label: "ศาลเจ้า" },
  { re: /ศาลเจ้า|ศาลเทพ|เทวสถาน/i, label: "ศาลเจ้า" },
  // ธรรมศาลา (ยิว) / synagogue
  { re: /synagogue/i, label: "ธรรมศาลา (ยิว)" },
];

/** แมป category ตัวเดียว -> ป้ายไทย (อาจใช้ชื่อช่วยเดาได้) */
function mapSingleCategoryToThai(cat: string, placeName?: string): string | null {
  const key = normalizeKey(cat);

  // 1) direct mapping
  if (DIRECT_MAP[key]) return DIRECT_MAP[key];

  // 2) กรณี generic ศาสนสถาน
  if (key === "place_of_worship") {
    if (placeName) {
      for (const { re, label } of WORSHIP_NAME_HINTS) {
        if (re.test(placeName)) return label;
      }
    }
    return "ศาสนสถาน";
  }

  // 3) กรณีอื่น ๆ ที่เป็น tourist family
  if (key.includes("view") || key.includes("scenic")) return "จุดชมวิว";
  if (key.includes("market")) return "ตลาด";
  if (key.includes("park")) return "สวนสาธารณะ/สวนสนุก";
  if (key.includes("museum")) return "พิพิธภัณฑ์";
  if (key.includes("gallery")) return "แกลเลอรี";
  if (key.includes("island")) return "เกาะ";
  if (key.includes("beach")) return "ชายหาด";
  if (key.includes("waterfall")) return "น้ำตก";
  if (key.includes("temple")) return "วัด";

  // ไม่แน่ใจ -> คืน null ให้ไปกรองทิ้งภายหลัง
  return null;
}

/**
 * แปลงอาเรย์ categories เดิม (อังกฤษ) -> ป้ายไทยที่ไม่ซ้ำและอ่านง่าย
 * @param categories เดิมจาก DB
 * @param placeName ใช้ช่วยเดาประเภทศาสนสถาน
 */
export function normalizeCategoriesToThai(categories: string[] | null | undefined, placeName?: string): string[] {
  const list = Array.isArray(categories) ? categories : [];
  const mapped = list
    .map((c) => mapSingleCategoryToThai(c, placeName))
    .filter((x): x is string => Boolean(x));

  // unique โดยรักษาลำดับแรกพบ
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const m of mapped) {
    if (!seen.has(m)) {
      seen.add(m);
      unique.push(m);
    }
  }
  return unique;
}

/**
 * ใช้กับผลลัพธ์ PlaceRecommendation ทั้งก้อน
 * - คืนชุดใหม่ที่ categories ถูกแปลงเป็นป้ายไทยแล้ว
 */
export function mapPlaceRecommendationsCategoriesThai(
  recs: PlaceRecommendation[]
): PlaceRecommendation[] {
  return (recs || []).map((r) => ({
    ...r,
    categories: normalizeCategoriesToThai(r.categories, r.name || undefined),
  }));
}

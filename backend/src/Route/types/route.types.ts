// src/Route/types/route.type.ts
import type { place } from "../../database/database.types";

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

export interface RouteSummary {
  distance: number;
  duration: number;
  steps: RouteStep[];
  geometry: any;
}

/**
 * ผลลัพธ์รวมเมื่อวางลำดับด้วย TSP แล้วเรียกเส้นทางจริงจาก ORS
 */
export interface PlannedRoute {
  /** ลำดับสถานที่จริงตามผล TSP */
  path: place[];
  /** ระยะรวมจากขั้น TSP (คำนวณด้วย Haversine/เกณฑ์ภายใน TSP) หน่วยกม. */
  tspDistanceKm: number;
  /** สรุปเส้นทางจริงจาก ORS (ระยะ/เวลา/ขั้นตอน/geometry) */
  route: RouteSummary;
}

export type Accessor = {
  username: string;
  is_super_user?: boolean;
  is_staff_user?: boolean;
};

export type RouteItemInput = {
  id?: string;                 // ถ้าไม่ส่งจะ gen ให้อัตโนมัติ
  place_id?: string | null;
  duration?: number | null;    // วินาที
  distance?: number | null;    // เมตร
  time_used?: number | null;   // วินาที (เวลาที่ใช้ ณ จุดนี้)
  note?: any | null;           // JSON
  index?: number;              // ลำดับในวัน (เริ่ม 1,...)
};

export type InsertRoutesOptions = {
  /** append = ต่อท้ายของเดิม, replace = ลบทิ้งของเดิมทั้งวันก่อนแล้วค่อยใส่ใหม่ */
  mode?: "append" | "replace";
  /**
   * indexing:
   *  - "auto"     : เพิกเฉย index ที่ส่งมา (ถ้ามี) แล้วจัดใหม่ตามลำดับอาเรย์
   *  - "respect"  : ใช้ index ที่ระบุมา (ต้องไม่ชนกัน/ไม่ชนของเดิม)
   *  - "autoIfMissing" (ค่าเริ่มต้น): ถ้า item ใดไม่มี index จะ auto ให้, ถ้ามีก็เคารพ
   */
  indexing?: "auto" | "respect" | "autoIfMissing";
  /** ใช้กับ auto/autoIfMissing: เริ่มนับจากอะไร; append=เริ่มจาก max+1 เป็นค่าเริ่มต้น */
  startIndex?: number;
};
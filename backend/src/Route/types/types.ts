// src/Route/types/route.type.ts
import type {geoJSONPoint } from "../../database/database.types";

type Time = string; // 'HH:mm'


export interface PlaceItem {
  type: 'place';
  id: string | null;
  place_id?: string;
  location?: geoJSONPoint;
  name?: string;
  startTime?: Time;
  endTime?: Time;
}

export type LineString = {
  type: "LineString";
  coordinates: [number, number][];
};

type ORSSegment = {
  distance: number;   // meters
  duration: number;   // seconds
};

type ORSGeoJSONRouteFeature = {
  type: "Feature";
  properties: {
    summary: { distance: number; duration: number };
    segments?: ORSSegment[];
  };
  geometry: LineString;
};

export type ORSGeoJSONResponse = {
  type: "FeatureCollection";
  features: ORSGeoJSONRouteFeature[];
};

export type RouteResult = {
  distance: number;
  duration: number;
  geometry: LineString;
  segments: ORSSegment[];
}

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
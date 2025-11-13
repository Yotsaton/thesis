// src/Route/types/route.type.ts
import type {geoJSONPoint } from "../../database/database.types";

type Time = string; // 'HH:mm'


export interface PlaceItem {
  type: 'place';
  id: string | null;
  place_id?: string;
  location: geoJSONPoint;
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

// ====== Options ======
export type TSPSolveOptions = {
  /** เลือกวิธีคำนวณระยะทาง */
  mode: 'haversine' | 'real';
  /**
   * จำนวน "จุดกลาง" สูงสุดที่ยอม brute force
   * เช่น 9 หมายถึง (n-2) <= 9 -> permutations = 9! = 362,880
   * ค่าเริ่มต้น: 9 (เหมาะกับเซิร์ฟเวอร์ทั่วไป)
   */
  limitMids?: number;
  /** ใช้เมื่อ mode = 'real' */
  apiKey?: string;
  /** โปรไฟล์ ORS: 'driving-car' (default), 'foot-walking', 'cycling-regular', ... */
  profile?: string;
  /** ORS base URL */
  baseUrl?: string; // default 'https://api.openrouteservice.org'
  /** timeout สำหรับเรียก ORS (ms) */
  timeoutMs?: number; // default 20000
};

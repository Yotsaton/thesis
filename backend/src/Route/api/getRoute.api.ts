// src/Route/routes/getRoute.api.ts
import { type Response } from "express";
import type { geoJSONPoint } from "../../database/database.types";
import { getRoute as getRouteCore } from "../functions/getRoute";
import { solveTSPFromPlaces } from "../functions/TSP_func";
import type { AuthenticatedRequest } from "../../middleware/type.api"; // ปรับ path ให้ตรงโปรเจกต์คุณ
import { GetRouteBodySchema, GetTSPWithRouteBody} from "../types/types.api";

/**
 * GET ROUTE API
 * ------------------------------
 * คำนวณเส้นทางขับรถจาก `origin` → (waypoints...) → `destination` โดยเรียก OpenRouteService ผ่านฟังก์ชันแกน `getRoute`
 *
 * @route POST /api/v1/route
 * @param {object} req.body - ข้อมูลสำหรับคำนวณเส้นทาง
 * @param {object} req.body.origin - จุดเริ่มต้นแบบ GeoJSON Point `{ type:"Point", coordinates:[lon,lat] }`
 * @param {object} req.body.destination - จุดหมายปลายทางแบบ GeoJSON Point
 * @param {object[]} [req.body.waypoint=[]] - จุดแวะระหว่างทาง (ศูนย์ตัวหรือหลายตัวก็ได้)
 *
 * @example
 * // Request Body
 * {
 *   "origin":      { "type": "Point", "coordinates": [100.4931, 13.7563] },
 *   "destination": { "type": "Point", "coordinates": [100.5018, 13.7563] },
 *   "waypoint": [
 *     { "type": "Point", "coordinates": [100.4972, 13.7569] }
 *   ]
 * }
 *
 * @returns 200 OK
 * {
 *   "success": true,
 *   "route": {
 *     "distance": number,          // เมตร
 *     "duration": number,          // วินาที
 *     "geometry": { "type":"LineString", "coordinates":[[lon,lat], ...] },
 *     "segments": [                 // ช่วงละจุด-ต่อ-จุด (ไม่มี steps)
 *       { "distance": number, "duration": number },
 *       ...
 *     ]
 *   }
 * }
 *
 * @errors
 * - 400 validation_error: รูปแบบ GeoJSON/ค่าวงเล็บเกินช่วง (-180..180, -90..90) หรืออินพุตไม่ครบ
 * - 400 route_error: ข้อความผิดพลาดฝั่งผู้ใช้ เช่น "At least two locations are required"
 * - 404 route_error: ไม่พบเส้นทาง ("No route found")
 * - 500 route_error: ปัญหาภายใน/ไม่ได้ตั้งค่า ORS_API_KEY เป็นต้น
 *
 * @notes
 * - ใช้หน่วยมาตรฐาน ORS: distance (m), duration (s)
 * - `segments` คืนเฉพาะ { distance, duration } ตามที่ระบุ “ไม่เอา steps”
 */
export const getRouteapi = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = GetRouteBodySchema.parse(req.body);
    const { origin, destination, waypoint } = parsed;

    // เรียกฟังก์ชันแกน (src/Route/functions/getRoute.ts)
    // ซิกเนเจอร์คาดว่า: (origin, destination, waypoint[]) => Promise<{ route: RouteResult }>
    const { route } = await getRouteCore(
      origin as geoJSONPoint,
      destination as geoJSONPoint,
      waypoint as geoJSONPoint[]
    );

    return res.status(200).json({
      success: true,
      route,
    });
  } catch (err: any) {
    // จัดการ error ของ Zod แยกเป็นกรณีพิเศษ เพื่อระบุ field ที่ผิด
    if (err?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        issues: err.issues,
      });
    }

    // แม็ปข้อความไปเป็นสถานะที่เหมาะสม (สอดคล้องกับสไตล์ createTrip.api.ts)
    const msg = typeof err?.message === "string" ? err.message : "unexpected_error";
    const status =
      msg.includes("No route found") ? 404 :
      msg.includes("At least") || msg.includes("out-of-range") || msg.includes("Invalid") ? 400 :
      msg.includes("ORS_API_KEY") ? 500 :
      500;

    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
};

/**
 * GET TSP + ROUTE API
 * ------------------------------------
 * จัดลำดับการแวะ (TSP แบบ fix start & end) จาก PlaceItem[]:
 *  - index 0 = จุดเริ่มต้น, index สุดท้าย = จุดหมาย
 *  - สลับเฉพาะระหว่างจุดกลาง (waypoints) เพื่อให้เส้นทางสั้นลง
 * แล้วเรียก ORS เพื่อคำนวณเส้นทางจริง พร้อมคืนค่า segments (distance/duration) แบบ “ไม่มี steps”
 *
 * @route POST /api/v1/route/tsp
 * @param {object} req.body
 * @param {PlaceItem[]} req.body.places - อาร์เรย์สถานที่ที่ 0=เริ่ม, n-1=จบ และทุกตัวต้องมี `location` เป็น GeoJSON Point
 *
 * @example
 * // Request Body
 * {
 *   "places": [
 *     { "type":"place", "id": "start", "location": { "type":"Point", "coordinates":[100.4931,13.7563] } },
 *     { "type":"place", "id": "A",     "location": { "type":"Point", "coordinates":[100.4972,13.7569] } },
 *     { "type":"place", "id": "B",     "location": { "type":"Point", "coordinates":[100.4991,13.7542] } },
 *     { "type":"place", "id": "end",   "location": { "type":"Point", "coordinates":[100.5018,13.7563] } }
 *   ]
 * }
 *
 * @returns 200 OK
 * {
 *   "success": true,
 *   "ordered": [PlaceItem, ...],    // ลำดับใหม่หลัง TSP (fix start/end)
 *   "route": {
 *     "distance": number,           // meters
 *     "duration": number,           // seconds
 *     "geometry": { "type":"LineString", "coordinates":[[lon,lat], ...] },
 *     "segments": [                 // รายช่วง (จุด→จุด) ไม่มี steps
 *       { "distance": number, "duration": number },
 *       ...
 *     ]
 *   }
 * }
 *
 * @errors
 * - 400 validation_error: โครงสร้างข้อมูลไม่ถูกต้อง / ค่าพิกัดนอกช่วง
 * - 400 route_error: อินพุตไม่พอ, ไม่มีเส้นทาง, หรือค่าที่ ORS ปฏิเสธ
 * - 404 route_error: ไม่พบเส้นทาง ("No route found")
 * - 500 route_error: ปัญหาภายใน/ไม่ได้ตั้งค่า ORS_API_KEY เป็นต้น
 *
 * @notes
 * - `places[0]` และ `places[last]` จะถูกตรึงเป็น start/end เสมอ
 * - ช่วงกลางเท่านั้นที่ถูกสับเรียงด้วย heuristic TSP (ตามไฟล์ TSP_func.ts)
 * - หน่วยของ ORS: distance เป็นเมตร, duration เป็นวินาที
 */
export const getTSPWithRouteapi = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = GetTSPWithRouteBody.parse(req.body);
    const { places } = parsed;

    // 1) ตรึง start/end และจัดลำดับจุดกลางด้วย TSP heuristic ของโปรเจกต์
    const { path: ordered } = solveTSPFromPlaces(places);

    // 2) map เป็น origin / waypoints / destination เพื่อเรียก ORS ผ่าน getRouteCore
    const origin = ordered[0].location as geoJSONPoint;
    const destination = ordered[ordered.length - 1].location as geoJSONPoint;
    const waypoint = ordered.slice(1, -1).map(p => p.location) as geoJSONPoint[];

    // 3) คำนวณเส้นทางจริง (คืนค่า { route } ที่มี segments distance/duration เท่านั้น)
    const { route } = await getRouteCore(origin, destination, waypoint);

    return res.status(200).json({
      success: true,
      ordered, // ลำดับที่ได้หลัง TSP (ใช้แสดงผล/บันทึกตามต้องการ)
      route,
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        issues: err.issues,
      });
    }

    const msg = typeof err?.message === "string" ? err.message : "unexpected_error";
    const status =
      msg.includes("No route found") ? 404 :
      msg.includes("At least") || msg.includes("out-of-range") || msg.includes("Invalid") ? 400 :
      msg.includes("ORS_API_KEY") ? 500 :
      500;

    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
};

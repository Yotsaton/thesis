// src/services/route/bulkInsertRoutes.ts
import crypto from "crypto";
import { db, pgp } from "../../database/db-promise";
import type { route } from "../../database/database.types";
import type { Accessor, RouteItemInput, InsertRoutesOptions } from "../types/route.types";

/**
 * แทรกรายการ route หลายแถวสำหรับ day_trip เดียวแบบมีสิทธิ์
 * - ผู้ใช้ทั่วไป: ทำได้เฉพาะ d_trip_id ที่อยู่ใต้ทริปของตัวเอง
 * - แอดมิน/สตาฟ: ทำได้ทุกทริป
 * - รองรับโหมด append/replace และ auto-index หรือใช้ index ที่ส่งมา
 * - คืนค่ารายการที่แทรกเรียบร้อย (เรียงตาม "index")
 */
export async function insertRoutesAuthorized(
  accessor: Accessor,
  d_trip_id: string,
  items: RouteItemInput[],
  opts: InsertRoutesOptions = {}
): Promise<route[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("ต้องมีรายการอย่างน้อย 1 รายการ");
  }

  const mode = opts.mode ?? "append";
  const indexing = opts.indexing ?? "autoIfMissing";
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);

  return db.tx(async (t) => {
    // 1) ตรวจสิทธิ์: d_trip_id ต้องอยู่ใต้ทริปของ accessor (ยกเว้นแอดมิน)
    const owner = await t.oneOrNone<{ username: string }>(
      `
      SELECT tr.username
      FROM public.day_trip dt
      JOIN public.trip tr ON tr.id = dt.trip_id
      WHERE dt.id = $1
      `,
      [d_trip_id]
    );
    if (!owner) throw new Error(`ไม่พบ day_trip: '${d_trip_id}'`);
    if (!isAdmin && owner.username !== accessor.username) {
      throw new Error("forbidden: คุณไม่มีสิทธิ์แก้ไข day_trip นี้");
    }

    // 2) ถ้า replace: ลบ route เก่าทั้งหมดก่อน
    if (mode === "replace") {
      await t.none(`DELETE FROM public.route WHERE d_trip_id = $1`, [d_trip_id]);
    }

    // 3) เตรียม index
    //    - กรณี append + auto : เริ่มจาก max(index)+1
    //    - กรณีอื่น: ใช้ startIndex ที่ส่งมา (ถ้ามี) ไม่งั้นเริ่มที่ 1
    let baseIndex = 1;
    if (mode === "append") {
      if (indexing === "auto" || indexing === "autoIfMissing") {
        const r = await t.one<{ max: number | null }>(
          `SELECT MAX("index") AS max FROM public.route WHERE d_trip_id = $1`,
          [d_trip_id]
        );
        baseIndex = (r.max ?? 0) + 1;
      } else {
        // respect → จะตรวจชนกับของเดิมด้านล่าง
        baseIndex = opts.startIndex ?? 1;
      }
    } else {
      // replace
      baseIndex = opts.startIndex ?? 1;
    }

    // 4) สร้างรายการสำหรับ insert พร้อม index/id ที่เหมาะสม
    //    - "auto"           : เพิกเฉย index ทั้งหมด → แจกตามลำดับ
    //    - "respect"        : ต้องมี index ในทุก item และไม่ซ้ำ; ไม่ซ้ำกับของเดิม (append เท่านั้น)
    //    - "autoIfMissing"  : item ไหนไม่มี index จัดให้ตามลำดับ (เริ่มจาก baseIndex/ต่อท้าย)
    let nextIdx = baseIndex;

    // ถ้า indexing=respect หรือมีคนส่ง index มาบางส่วน → เก็บ index ที่ส่งมาไว้ตรวจซ้ำ
    const providedIdx = new Set<number>();
    for (const it of items) {
      if (it.index !== undefined) {
        if (!Number.isInteger(it.index) || it.index <= 0) {
          throw new Error(`index ต้องเป็นจำนวนเต็มบวก: ${it.index}`);
        }
        if (providedIdx.has(it.index)) {
          throw new Error(`index ซ้ำในข้อมูลนำเข้า: ${it.index}`);
        }
        providedIdx.add(it.index);
      }
    }

    // ถ้า indexing=respect และ mode=append: ตรวจชนกับของเดิม
    if (indexing === "respect" && mode === "append" && providedIdx.size > 0) {
      const arr = Array.from(providedIdx.values()).sort((a, b) => a - b);
      const exist = await t.any<{ index: number }>(
        `SELECT "index" FROM public.route WHERE d_trip_id = $1 AND "index" = ANY($2::int[])`,
        [d_trip_id, arr]
      );
      if (exist.length > 0) {
        const dup = exist.map((r) => r.index).sort((a, b) => a - b);
        throw new Error(`index ต่อไปนี้ชนกับของเดิม: [${dup.join(", ")}]`);
      }
    }

    const rows = items.map((raw) => {
      const id = raw.id ?? crypto.randomUUID();
      let idx: number;

      if (indexing === "auto") {
        idx = nextIdx++;
      } else if (indexing === "respect") {
        if (raw.index === undefined) {
          throw new Error("indexing='respect' ต้องระบุ index ในทุก item");
        }
        idx = raw.index;
      } else {
        // autoIfMissing
        idx = raw.index ?? nextIdx++;
      }

      return {
        id,
        d_trip_id,
        place_id: raw.place_id ?? null,
        duration: raw.duration ?? null,
        distance: raw.distance ?? null,
        time_used: raw.time_used ?? null,
        note: raw.note ?? null,
        index: idx,
        // created_at/updated_at ปล่อยให้ DEFAULT/trigger จัดการ
      };
    });

    // 5) ใช้ pg-promise helpers ทำ bulk insert + RETURNING
    const cs = new pgp.helpers.ColumnSet(
      [
        "id",
        "d_trip_id",
        "place_id",
        "duration",
        "distance",
        "time_used",
        { name: "note", mod: ":json" },
        // reserved word → helpers จะใส่ "index" ให้เอง
        "index",
      ],
      { table: new pgp.helpers.TableName({ table: "route", schema: "public" }) }
    );

    const insertSql = pgp.helpers.insert(rows, cs) +
      ` RETURNING id, d_trip_id, place_id, created_at, duration, distance, time_used, note, "index", updated_at`;

    const inserted = await t.any<route>(insertSql);

    // เรียงผลลัพธ์ตาม index ให้ predictable
    inserted.sort((a, b) => a.index - b.index);
    return inserted;
  });
}

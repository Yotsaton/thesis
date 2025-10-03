// /src/database/db-promise.ts
import "dotenv/config";
import pgPromise from "pg-promise";
import wkx from 'wkx';

const isTestEnvironment = process.env.NODE_ENV === "test";

const pgp = pgPromise({
  query: (e) => {
    if (process.env.NODE_ENV !== "production") {
      console.log("QUERY:", e.query);
    }
  },
  connect: async (e) => {
    // ไม่จำเป็นถ้า schema/พาร์สชัดเจนแล้ว แต่ช่วยลดความสับสนเวลา debug
    await e.client.query(`SET TIME ZONE 'Asia/Bangkok'`);
  },
});

const connection = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: isTestEnvironment ? process.env.DB_DATABASE_TEST : process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // ssl: { rejectUnauthorized: false }, // ถ้าจำเป็น
};

const db = pgp(connection);
/**
 * ตั้งค่าการแปลงชนิดข้อมูลจาก Postgres -> JavaScript
 *
 * OID:
 *  - 1082 = date
 *  - 1114 = timestamp without time zone
 *  - 1184 = timestamp with time zone (timestamptz)
 */

// 1) ให้ `date` คงเป็นสตริง 'YYYY-MM-DD' (แนะนำสำหรับงานปฏิทิน)
pgp.pg.types.setTypeParser(1082, (s: string) => s);

// 2) ให้ `timestamptz` กลายเป็น JS Date (JS จะเก็บเป็น epoch UTC อยู่แล้ว)
pgp.pg.types.setTypeParser(1184, (s: string) => new Date(s));

// 3) ให้ `timestamp without time zone` และต้องการถือว่าเป็น UTC เสมอ:
pgp.pg.types.setTypeParser(1114, (s: string) => new Date(s.replace(" ", "T") + "+07:00"));

// 4) ให้ `geography` กลายเป็น GeoJSON object 
export async function initGeographyTypeParser() {
  // หา OID ของชนิด geography จากระบบ
  const { oid } = await db.one<{ oid: number }>(`
    SELECT t.oid
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'geography'
    LIMIT 1
  `);

  // ผูกตัวแปลง: ค่า geography (ส่งมาเป็น EWKB hex string) -> GeoJSON object
  pgp.pg.types.setTypeParser(oid, (s: string) => {
    const buf = Buffer.from(s, 'hex');          // EWKB hex -> Buffer
    const g = wkx.Geometry.parse(buf).toGeoJSON();  // -> { type, coordinates }
    return g;
  });
}
// เรียก parser setup ตอน init
initGeographyTypeParser().catch(err => {
  console.error("[db] Failed to init geography parser", err);
});

export { db, pgp };

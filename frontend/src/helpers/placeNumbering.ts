import { appState } from "../state/index.js";
import { TRIP_COLORS } from "../helpers/utils.js";
import type { Day, DayItem } from "../types.js";

/**
 * คืนค่าข้อมูลลำดับของแต่ละสถานที่
 * - ถ้าอยู่ในโหมดรายวัน (activeDayIndex ≠ null): เริ่มจาก 1 ภายในวันนั้น
 * - ถ้าอยู่ในโหมดภาพรวม (overview mode): เริ่มจาก 1 ทั้งทริปและไล่ต่อไปเรื่อย ๆ
 * - พร้อมแนบสีของวันตาม TRIP_COLORS
 */
export function getPlaceNumbering(): Record<
  string,
  { number: number; color: string }
> {
  const numbering: Record<string, { number: number; color: string }> = {};
  const isOverview = appState.activeDayIndex === null;
  let globalCounter = 1;

  appState.currentTrip.days.forEach((day: Day, dayIdx: number) => {
    let dayCounter = 1;
    const dayColor = TRIP_COLORS[dayIdx % TRIP_COLORS.length];

    day.items?.forEach((item: DayItem, itemIdx: number) => {
      if (item.type === "place") {
        const key = `${dayIdx}-${itemIdx}`;
        numbering[key] = {
          number: isOverview ? globalCounter++ : dayCounter++,
          color: dayColor,
        };
      }
    });
  });

  return numbering;
}

// src/trip/function/toDateOnly.ts

// function types support

/** แปลง input ให้เป็นสตริง YYYY-MM-DD (กันปัญหา timezone ของ Date) */
export function toDateOnly(input: string | Date): string {
  if (input instanceof Date) {
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, "0");
    const d = String(input.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // assume รูปแบบ YYYY-MM-DD มาก่อนแล้ว
  // (ถ้าคุณอยากเข้มงวดกว่านี้ เพิ่ม validate เพิ่มได้)
  return input;
}
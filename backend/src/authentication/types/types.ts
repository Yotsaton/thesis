// src/authentication/types/types.ts

/**
 * พารามิเตอร์สำหรับ insert ผู้ใช้ใหม่ (ค่า default จะถูกเติมใน service/SQL)
 */
export type users_insert_params = {
  username: string;
  email: string;
  password: string;
  is_verify?: boolean;      // default: false
  is_online?: boolean;      // default: false
  last_login?: Date | null; // default: null
};

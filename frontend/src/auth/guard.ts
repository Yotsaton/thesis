// src/auth/guard.ts
import { CONFIG } from '../services/config.js';

// ตั้งค่านี้เป็น true หากต้องการบังคับให้ login ก่อนเข้าหน้าอื่น
if (CONFIG.REQUIRE_AUTH) {
  const token = localStorage.getItem('authToken');
  // ตรวจสอบว่าหน้าปัจจุบันไม่ใช่หน้า main.html หรือ reset-password.html
  const isAuthPage = window.location.pathname.endsWith('/main.html') || window.location.pathname.endsWith('/reset-password.html');
  
  if (!token && !isAuthPage) {
    // ใช้ Path ที่ถูกต้องสำหรับ Vite
    window.location.href = '/main.html'; 
  }
}
// src/pages/main/index.js
import { initializeAuthUI } from '../../auth/auth.js';

// รอให้ HTML โหลดเสร็จ แล้วค่อยเริ่มทำงาน
document.addEventListener('DOMContentLoaded', () => {
  initializeAuthUI();
});
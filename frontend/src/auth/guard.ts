// src/auth/guard.ts
import { getCurrentUser } from './authService.js';

// ✅ รายชื่อหน้าที่ไม่ต้องตรวจ login
const PUBLIC_PAGES = ['/main.html', '/reset-password.html'];

(async () => {
  const currentPath = window.location.pathname;
  //console.log('[GUARD] Current path:', currentPath);

  // ถ้าเป็นหน้าสาธารณะ → ไม่ต้องเช็ค
  if (PUBLIC_PAGES.includes(currentPath)) return;

  try {
    const res = await getCurrentUser();
    const user = res.user || res.data || res;

    // ❌ ถ้ายังไม่ได้ login → กลับหน้า login
    if (!res.success || !user.username) {
      window.location.href = '/main.html';
      return;
    }

    // 🔒 ถ้าเป็น admin/staff → redirect ไปหน้า admin.html ถ้าอยู่ที่หน้า user
    if ((user.is_super_user || user.is_staff_user) && currentPath !== '/admin.html') {
      window.location.href = '/admin.html';
      return;
    }

    // 🔒 ถ้าเป็น user ปกติ แต่เข้า admin → กลับ my-plans
    if (!(user.is_super_user || user.is_staff_user) && currentPath === '/admin.html') {
      window.location.href = '/my-plans.html';
      return;
    }

    // ✅ ถ้า login แล้วแต่เปิดหน้า index.html → ไปหน้า my-plans.html
    if (currentPath === '/') {
      window.location.href = '/my-plans.html';
      return;
    }

  } catch (err) {
    console.error('[GUARD] Failed to verify user:', err);
    window.location.href = '/main.html';
  }
})();

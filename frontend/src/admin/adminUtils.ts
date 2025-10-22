// src/admin/adminUtils.ts
import { CONFIG } from '../services/config.js';

/** ตรวจสอบสิทธิ์ก่อนเข้า admin page */
export async function verifyAdminAccess(): Promise<void> {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) throw new Error('Unauthorized');
    const json = await res.json();
    const user = json.user || json.data || json;

    if (!(user.is_super_user || user.is_staff_user)) {
      alert('คุณไม่มีสิทธิ์เข้าหน้านี้');
      window.location.href = '/my-plans.html';
    }
  } catch (err) {
    console.error('[ADMIN] Unauthorized or session expired:', err);
    window.location.href = '/main.html';
  }
}

/** ตั้งค่า logout button */
export function setupLogoutButton(): void {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', () => {
    fetch(`${CONFIG.API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).finally(() => (window.location.href = '/main.html'));
  });
}

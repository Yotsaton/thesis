// src/pages/admin/admin.ts
import { verifyAdminAccess, setupLogoutButton } from '../../admin/adminUtils.js';
import { initLogTab } from '../../admin/logManager.js';
import { initUserTab } from '../../admin/userManager.js';

document.addEventListener('DOMContentLoaded', async () => {
  // ตรวจสิทธิ์แอดมินก่อน
  await verifyAdminAccess();
  setupLogoutButton();

  const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const contents = document.querySelectorAll<HTMLElement>('.tab-content');

  // ✅ ฟังก์ชันสลับแท็บ (รวม logic เดิม)
  function activateTab(tabName: string) {
    // ล้างทุกสถานะก่อน
    tabs.forEach(b => b.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    // ตั้งค่าปุ่มที่เลือก
    const btn = document.querySelector<HTMLButtonElement>(`.tab-btn[data-tab="${tabName}"]`);
    const content = document.getElementById(`tab-${tabName}`);
    if (btn && content) {
      btn.classList.add('active');
      content.classList.add('active');
    }

    // โหลดข้อมูลเฉพาะแท็บนั้น
    if (tabName === 'logs') initLogTab();
    else if (tabName === 'users') initUserTab();
  }

  // ✅ ตั้ง event ให้ปุ่มทุกอัน
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      if (tabName) activateTab(tabName);
    });
  });

  // ✅ เปิดแท็บเริ่มต้นแบบปลอดภัย (ไม่ใช้ .click())
  activateTab('logs');
});

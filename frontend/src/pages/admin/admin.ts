// /src/pages/admin/admin.ts
import { fetchActivityLogs, fetchAllUsers, updateUserRole, deleteUser } from '../../services/adminService.js';

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const contents = document.querySelectorAll<HTMLElement>('.tab-content');
  
  if (!tabs.length || !contents.length) return; // กันหน้าอื่นเรียกไฟล์นี้
  
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.remove('active'));
      contents.forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
      
      if (btn.dataset.tab === 'logs') loadLogs();
      if (btn.dataset.tab === 'users') loadUsers();
    });
  });
  
  // เลือกแท็บเริ่มต้น
  const initial = document.querySelector<HTMLButtonElement>('.tab-btn[data-tab="logs"]');
  if (initial) initial.click();
  
  async function loadLogs() {
    const body = document.getElementById('logs-body')!;
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;">กำลังโหลด...</td></tr>`;
    try {
      const data = await fetchActivityLogs();
      body.innerHTML = data.length
      ? data.map((log: any) => `
      <tr>
      <td>${new Date(log.created_at).toLocaleString('th-TH')}</td>
      <td>${log.username}</td>
      <td>${log.ip_addr}</td>
      <td>${log.activity_json?.action || log.activity_json?.message || '-'}</td>
      </tr>
      `).join('')
      : `<tr><td colspan="4" style="text-align:center;">ไม่พบข้อมูล</td></tr>`;
    } catch (e: any) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#b33;">โหลด Log ไม่สำเร็จ</td></tr>`;
      if (e?.status === 401) window.location.href = '/login.html';
    }
  }
  
  type ApiUser = {
    username: string;
    email: string;
    is_super_user: boolean;
    is_staff_user: boolean;
    is_verify: boolean;
    is_online: boolean;
    last_login: string | null;
    last_seen: string | null;
    created_at: string;
    is_deleted: boolean;
    deleted_at: string | null;
  };
  type Role = 'User' | 'Staff' | 'Admin';

  const toRole = (u: ApiUser): Role =>
    u.is_super_user ? 'Admin' : u.is_staff_user ? 'Staff' : 'User';
  
  async function loadUsers() {
    const body = document.getElementById('users-body')!;
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;">กำลังโหลด...</td></tr>`;
    try {
      const users = await fetchAllUsers();
      body.innerHTML = users.length
        ? users.map((u: any) => `
          <tr>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>
              <select class="role-select" data-id="${u.username}">
                <option value="user"  ${toRole(u) === 'User'  ? 'selected' : ''}>User</option>
                <option value="staff" ${toRole(u) === 'Staff' ? 'selected' : ''}>Staff</option>
                <option value="admin" ${toRole(u) === 'Admin' ? 'selected' : ''}>Admin</option>
              </select>
            </td>
            <td>
              <button class="btn-delete" data-id="${u.username}"><i class="bx bx-trash"></i> ลบ</button>
            </td>
          </tr>
        `).join('')
        : `<tr><td colspan="4" style="text-align:center;">ไม่พบผู้ใช้</td></tr>`;

      // update role
      document.querySelectorAll<HTMLSelectElement>('.role-select').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const id = sel.dataset.id!;
          const role = sel.value;
          const res = await updateUserRole(id, role);
          alert(res.success ? 'อัปเดตสิทธิ์เรียบร้อย' : (res.message || 'ไม่สามารถอัปเดตได้'));
          loadUsers();
        });
      });
      // delete user
      document.querySelectorAll<HTMLButtonElement>('.btn-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้?')) return;
          const id = btn.dataset.id!;
          const res = await deleteUser(id);
          alert(res.success ? 'ลบผู้ใช้สำเร็จ' : (res.message || 'ไม่สามารถลบได้'));
          loadUsers();
        });
      });
    } catch (e: any) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#b33;">โหลด Users ไม่สำเร็จ</td></tr>`;
      if (e?.status === 401) window.location.href = '/login.html';
    }
  }
});

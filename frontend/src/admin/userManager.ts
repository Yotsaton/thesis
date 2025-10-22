// src/admin/userManager.ts
import { fetchAllUsers, updateUserRole, deleteUser } from '../services/adminService.js';

export async function initUserTab(): Promise<void> {
  await loadUsers();
}

async function loadUsers() {
  const body = document.getElementById('users-body')!;
  body.innerHTML = `<tr><td colspan="4" style="text-align:center;">กำลังโหลด...</td></tr>`;

  try {
    const users = await fetchAllUsers();
    const toRole = (u: any) =>
      u.is_super_user ? 'Admin' : u.is_staff_user ? 'Staff' : 'User';

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
          <td><button class="btn-delete" data-id="${u.username}"><i class="bx bx-trash"></i> ลบ</button></td>
        </tr>
      `).join('')
      : `<tr><td colspan="4" style="text-align:center;">ไม่พบผู้ใช้</td></tr>`;

    // ตั้ง event ให้ select & delete
    document.querySelectorAll<HTMLSelectElement>('.role-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.id!;
        const role = sel.value;
        const res = await updateUserRole(id, role);
        alert(res.success ? 'อัปเดตสิทธิ์เรียบร้อย' : res.message || 'ไม่สามารถอัปเดตได้');
        loadUsers();
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้?')) return;
        const id = btn.dataset.id!;
        const res = await deleteUser(id);
        alert(res.success ? 'ลบผู้ใช้สำเร็จ' : res.message || 'ไม่สามารถลบได้');
        loadUsers();
      });
    });
  } catch {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#b33;">โหลด Users ไม่สำเร็จ</td></tr>`;
  }
}

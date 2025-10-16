// src/pages/admin/users.ts

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

const API_URL = `${window.API_BASE_URL}/admin/users`;
const tbody = document.getElementById("users-body") as HTMLTableSectionElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const roleFilter = document.getElementById("role-filter") as HTMLSelectElement;

// 🧭 ตรวจสิทธิ์ Admin ก่อนเข้า
(async () => {
  try {
    const res = await fetch(`${window.API_BASE_URL}/auth/me`, { credentials: "include" });
    if (!res.ok) throw new Error("Unauthorized");
    const user = await res.json();
    if (user.role !== "admin") {
      alert("คุณไม่มีสิทธิ์เข้าหน้านี้");
      window.location.href = "/my-plans.html";
      return;
    }
    fetchUsers();
  } catch {
    window.location.href = "/login.html";
  }
})();

async function fetchUsers(): Promise<void> {
  try {
    const res = await fetch(API_URL, { credentials: "include" });
    if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
    const json = await res.json();
    renderUsers(json.data || []);
  } catch (err: any) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#888;">${err.message}</td></tr>`;
  }
}

function renderUsers(users: User[]): void {
  const search = searchInput.value.toLowerCase();
  const filter = roleFilter.value;

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.username.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search);
    const matchRole = !filter || u.role === filter;
    return matchSearch && matchRole;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (u) => `
      <tr>
        <td>${u.username}</td>
        <td>${u.email}</td>
        <td><span class="role-badge role-${u.role}">${u.role}</span></td>
        <td>${new Date(u.created_at).toLocaleDateString("th-TH")}</td>
        <td>
          <button class="btn-edit" data-id="${u.id}"><i class='bx bx-edit'></i></button>
          <button class="btn-delete" data-id="${u.id}"><i class='bx bx-trash'></i></button>
        </td>
      </tr>
    `
    )
    .join("");

  // Attach events
  document.querySelectorAll<HTMLButtonElement>(".btn-delete").forEach((btn) =>
    btn.addEventListener("click", () => deleteUser(btn.dataset.id!))
  );

  document.querySelectorAll<HTMLButtonElement>(".btn-edit").forEach((btn) =>
    btn.addEventListener("click", () => editRole(btn.dataset.id!))
  );
}

async function deleteUser(userId: string): Promise<void> {
  if (!confirm("คุณต้องการลบผู้ใช้นี้หรือไม่?")) return;
  try {
    const res = await fetch(`${API_URL}/${userId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) throw new Error("ลบไม่สำเร็จ");
    alert("ลบผู้ใช้เรียบร้อยแล้ว");
    fetchUsers();
  } catch (err: any) {
    alert(err.message);
  }
}

async function editRole(userId: string): Promise<void> {
  const newRole = prompt("กรุณาใส่สิทธิ์ใหม่ (admin / staff / user):");
  if (!newRole) return;
  try {
    const res = await fetch(`${API_URL}/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) throw new Error("เปลี่ยนสิทธิ์ไม่สำเร็จ");
    alert("เปลี่ยนสิทธิ์เรียบร้อยแล้ว");
    fetchUsers();
  } catch (err: any) {
    alert(err.message);
  }
}

document.getElementById("refresh-btn")?.addEventListener("click", fetchUsers);
searchInput.addEventListener("input", fetchUsers);
roleFilter.addEventListener("change", fetchUsers);

document.getElementById("logout-btn")?.addEventListener("click", async () => {
  await fetch(`${window.API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
  window.location.href = "/login.html";
});

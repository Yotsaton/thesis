// src/pages/admin/admin.ts

const API = import.meta.env.VITE_API_URL;

const adminTbody = document.getElementById("logs-body") as HTMLTableSectionElement;
const adminSearchInput = document.getElementById("search-input") as HTMLInputElement;
const filterAction = document.getElementById("filter-action") as HTMLSelectElement;
const refreshBtn = document.getElementById("refresh-btn")!;
const logoutBtn = document.getElementById("logout-btn")!;

async function fetchLogs(): Promise<void> {
  try {
    const res = await fetch(`${API}/auth/activity/logs`, { credentials: "include" });
    if (!res.ok) throw new Error("Access denied");
    const json = await res.json();
    renderLogs(json.items || []);
  } catch (err: any) {
    adminTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#888;">${err.message}</td></tr>`;
  }
}

function renderLogs(logs: any[]): void {
  const search = adminSearchInput.value.toLowerCase();
  const filter = filterAction.value;

  const filtered = logs.filter((log) => {
    const matchSearch =
      !search ||
      (log.username && log.username.toLowerCase().includes(search)) ||
      (log.activity && log.activity.toLowerCase().includes(search));
    const matchAction = !filter || log.activity?.toLowerCase().includes(filter);
    return matchSearch && matchAction;
  });

  if (filtered.length === 0) {
    adminTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  adminTbody.innerHTML = filtered
    .map(
      (l) => `
      <tr>
        <td>${new Date(l.created_at).toLocaleString("th-TH")}</td>
        <td>${l.username || "—"}</td>
        <td>${l.activity || "—"}</td>
        <td>${l.detail || "-"}</td>
      </tr>
    `
    )
    .join("");
}

refreshBtn.addEventListener("click", fetchLogs);
adminSearchInput.addEventListener("input", fetchLogs);
filterAction.addEventListener("change", fetchLogs);

logoutBtn.addEventListener("click", async () => {
  await fetch(`${window.API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
  window.location.href = "/login.html";
});

// ตรวจสิทธิ์ admin ก่อนเข้า
(async () => {
  try {
    const res = await fetch(`${API}/auth/me`, { method: "GET", credentials: "include" });
    if (!res.ok) throw new Error("Unauthorized");
    const user = await res.json();
    if ((user.user.is_super_user || user.user.is_staff_user) !== true) {
      alert("คุณไม่มีสิทธิ์เข้าหน้านี้");
      window.location.href = "/my-plans.html";
      return;
    }
    fetchLogs();
  } catch {
    window.location.href = "/login.html";
  }
})();

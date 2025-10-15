// src/pages/admin/admin.ts
const API_URL = `${window.API_BASE_URL}/admin/activity-logs`;

const tbody = document.getElementById("logs-body") as HTMLTableSectionElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const filterAction = document.getElementById("filter-action") as HTMLSelectElement;
const refreshBtn = document.getElementById("refresh-btn")!;
const logoutBtn = document.getElementById("logout-btn")!;

async function fetchLogs(): Promise<void> {
  try {
    const res = await fetch(API_URL, { credentials: "include" });
    if (!res.ok) throw new Error("Access denied");
    const json = await res.json();
    renderLogs(json.data || []);
  } catch (err: any) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#888;">${err.message}</td></tr>`;
  }
}

function renderLogs(logs: any[]): void {
  const search = searchInput.value.toLowerCase();
  const filter = filterAction.value;

  const filtered = logs.filter((log) => {
    const matchSearch =
      !search ||
      (log.username && log.username.toLowerCase().includes(search)) ||
      (log.action && log.action.toLowerCase().includes(search));
    const matchAction = !filter || log.action?.toLowerCase().includes(filter);
    return matchSearch && matchAction;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (l) => `
      <tr>
        <td>${new Date(l.timestamp).toLocaleString("th-TH")}</td>
        <td>${l.username || "—"}</td>
        <td>${l.action || "—"}</td>
        <td>${l.detail || "-"}</td>
      </tr>
    `
    )
    .join("");
}

refreshBtn.addEventListener("click", fetchLogs);
searchInput.addEventListener("input", fetchLogs);
filterAction.addEventListener("change", fetchLogs);

logoutBtn.addEventListener("click", async () => {
  await fetch(`${window.API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
  window.location.href = "/login.html";
});

// ตรวจสิทธิ์ admin ก่อนเข้า
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
    fetchLogs();
  } catch {
    window.location.href = "/login.html";
  }
})();

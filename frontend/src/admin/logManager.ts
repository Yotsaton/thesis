// src/admin/logManager.ts
import { fetchActivityLogs } from '../services/adminService.js';

let cachedLogs: any[] = [];

export async function initLogTab(): Promise<void> {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const filterSelect = document.getElementById('filter-action') as HTMLSelectElement;

  await loadLogs();

  searchInput?.addEventListener('input', filterLogs);
  filterSelect?.addEventListener('change', filterLogs);
}

async function loadLogs() {
  const body = document.getElementById('logs-body')!;
  body.innerHTML = `<tr><td colspan="4" style="text-align:center;">กำลังโหลด...</td></tr>`;

  try {
    const data = await fetchActivityLogs();
    cachedLogs = data;
    renderLogs(cachedLogs);
  } catch {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#b33;">โหลด Log ไม่สำเร็จ</td></tr>`;
  }
}

function renderLogs(logs: any[]) {
  const body = document.getElementById('logs-body')!;
  if (!logs?.length) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  body.innerHTML = logs.map((log) => `
    <tr>
      <td>${new Date(log.created_at).toLocaleString('th-TH')}</td>
      <td>${log.username}</td>
      <td>${log.ip_addr}</td>
      <td>${log.activity_json?.action || log.activity_json?.message || '-'}</td>
    </tr>
  `).join('');
}

function filterLogs() {
  const keyword = (document.getElementById('search-input') as HTMLInputElement)?.value.trim().toLowerCase();
  const action = (document.getElementById('filter-action') as HTMLSelectElement)?.value.trim().toLowerCase();

  let filtered = cachedLogs;
  if (keyword) {
    filtered = filtered.filter((log) =>
      log.username?.toLowerCase().includes(keyword) ||
      log.activity_json?.action?.toLowerCase().includes(keyword) ||
      log.activity_json?.message?.toLowerCase().includes(keyword)
    );
  }

  if (action) {
    filtered = filtered.filter((log) =>
      log.activity_json?.action?.toLowerCase() === action
    );
  }

  renderLogs(filtered);
}

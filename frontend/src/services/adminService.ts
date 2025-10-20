// /src/services/adminService.ts
import { CONFIG } from './config.js';

const BASE = CONFIG.API_BASE_URL; // เช่น http://localhost:3000/api/v1

// ถ้า backend map: app.use("/api/v1/auth/activity", activityRouter)
export async function fetchActivityLogs() {
  const res = await fetch(`${BASE}/auth/activity/logs`, {
    credentials: 'include',
  });
  if (!res.ok) throw { status: res.status, message: 'activity logs failed' };
  const json = await res.json();
  return json.success ? json.data : [];
}

// ถ้า backend map: app.use("/api/v1/admin", adminRouter)
export async function fetchAllUsers() {
  const res = await fetch(`${BASE}/admin/users`, {
    credentials: 'include',
  });
  if (!res.ok) throw { status: res.status, message: 'fetch users failed' };
  const json = await res.json();
  return json.success ? json.data : [];
}

export async function updateUserRole(id: string, role: string) {
  const res = await fetch(`${BASE}/admin/users/${id}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw { status: res.status, message: 'update role failed' };
  return res.json();
}

export async function deleteUser(id: string) {
  const res = await fetch(`${BASE}/admin/users/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw { status: res.status, message: 'delete user failed' };
  return res.json();
}

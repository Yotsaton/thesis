// /src/services/adminService.ts
import { CONFIG } from './config.js';

const BASE = CONFIG.API_BASE_URL;

// ----------- bodyFetchLogs schemas from backend -----------
// Schema for fetching activity logs
// ทำมาด้วยถ้าอยากให้ช่อง search มันใช้ได้ 
const fetchActivityLogsSchema = z.object({
  username: z.string().min(1).optional(),
  ip: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.coerce.number().int().optional(),
  asc: z.coerce.number().int().optional(), // 1 = ASC, 0/omit = DESC
});
// ถ้า backend map: app.use("/api/v1/auth/activity", activityRouter)
export async function fetchActivityLogs() {
  const res = await fetch(`${BASE}/auth/activity/logs`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw { status: res.status, message: 'activity logs failed' };
  const json = await res.json();
  return json.success ? json.items : [];
}

// ถ้า backend map: app.use("/api/v1/admin", adminRouter)
export async function fetchAllUsers() {
  const res = await fetch(`${BASE}/admin/users`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw { status: res.status, message: 'fetch users failed' };
  const json = await res.json();
  return json.success ? json.data : [];
}

export async function updateUserRole(username: string, role: string) {
  const encoded = encodeURIComponent(username);

  let is_super_user: boolean;
  let is_staff_user: boolean;
  if (role === "admin") {
    is_super_user = true;  is_staff_user = true;
  } else if (role === "staff") {
    is_super_user = false; is_staff_user = true;
  } else {
    is_super_user = false; is_staff_user = false;
  }
  const res = await fetch(`${BASE}/admin/users/${encoded}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ is_super_user, is_staff_user }),
  });
  if (!res.ok) throw { status: res.status, message: 'update role failed' };
  return res.json();
}

export async function deleteUser(username: string) {
  const res = await fetch(`${BASE}/admin/users/${username}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw { status: res.status, message: 'delete user failed' };
  return res.json();
}

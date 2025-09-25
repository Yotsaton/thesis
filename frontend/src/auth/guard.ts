import { CONFIG } from '../services/config.js';

if (CONFIG.REQUIRE_AUTH) {
  const token = localStorage.getItem('authToken');
  const isAuthPage = location.pathname.endsWith('/main.html');
  if (!token && !isAuthPage) { location.href = '/public/main.html'; }
}

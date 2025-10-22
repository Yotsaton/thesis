// src/pages/main/index.ts
import { initializeAuthUI } from '../../auth/auth.js';

// ให้ initializeAuthUI() จัดการทุกอย่างของ Login/Register/Redirect
document.addEventListener('DOMContentLoaded', () => {
  initializeAuthUI();
});

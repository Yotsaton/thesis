//src/pages/main/index.ts
import { initializeAuthUI } from '../../auth/auth.js';

// Wait for the DOM to be fully loaded before initializing the UI
document.addEventListener('DOMContentLoaded', () => {
  initializeAuthUI();
});
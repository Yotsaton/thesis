// vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    host: true, // ยอมรับการเชื่อมต่อจากภายนอก (เช่น ngrok)
    allowedHosts: ['nonimbricative-uncondoled-tequila.ngrok-free.dev'], // ← ใส่โดเมน ngrok ที่คุณได้
    proxy: {
      '/api/v1': { target: 'http://localhost:3000', changeOrigin: true },
    },
    // ช่วยให้ HMR ทำงานผ่าน https ของ ngrok
    hmr: {
      clientPort: 443,
      host: 'nonimbricative-uncondoled-tequila.ngrok-free.dev', // ใส่โดเมน ngrok เดียวกัน
      protocol: 'wss',
    },
  },
  plugins: [react()],
})

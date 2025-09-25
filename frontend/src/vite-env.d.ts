/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  // สามารถเพิ่มตัวแปร .env อื่นๆ ได้ที่นี่
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
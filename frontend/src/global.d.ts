// src/global.d.ts
declare global {
  interface Window {
    // สำหรับ Google Maps Callback
    onMapsApiLoaded: () => void;

    // สำหรับ DOMPurify
    DOMPurify: {
      sanitize: (dirty: string) => string;
    };

    // สำหรับ API Key ที่เราตั้งไว้ใน config
    GOOGLE_MAPS_API_KEY: string;

    // 🆕 สำหรับ API backend
    API_BASE_URL?: string;
  }
}

// บรรทัดนี้จำเป็นเพื่อให้ไฟล์นี้เป็น module
export {};

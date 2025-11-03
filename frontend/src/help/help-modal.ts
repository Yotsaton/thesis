// src/help/help-modal.ts
console.log('[HELP] Module loaded ✅');

export function initHelpModal(): void {
  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('help-modal');
  const helpClose = document.getElementById('help-close');
  const helpTopics = document.getElementById('help-topics');
  const helpVideo = document.getElementById('help-video') as HTMLIFrameElement | null;

  // 🎥 ลิงก์วิดีโอของแต่ละหัวข้อ (สามารถเปลี่ยนเป็นลิงก์จริงได้ภายหลัง)
  const helpLinks: Record<string, string> = {
    intro: 'https://www.youtube.com/embed/taoObotE1_U?si=QZT6w8qT-W5iGfP2',       // เริ่มต้นใช้งาน / สร้างแผนเที่ยวใหม่
    dates: 'https://www.youtube.com/embed/Wc4QvAR7BKY?si=H2kWpyfDGuKwOFiL',       // กำหนดช่วงวันเดินทาง
    add: 'https://www.youtube.com/embed/GDCsk6kgkXM?si=t1VPZ8KeVrRDk4mV',           // เพิ่มสถานที่ท่องเที่ยวในแต่ละวัน
    details: 'https://www.youtube.com/embed/J-czJ81wuW0?si=5RqDfIto-VmdDzFG',   // ตั้งเวลา / เพิ่มบันทึกภายในวัน
    order: 'https://www.youtube.com/embed/rN-kxDpN2jg?si=htVYxTk6UW7E8vsZ',       // การจัดลำดับสถานที่ (ลาก–วาง)
    manage: 'https://www.youtube.com/embed/8A-6kXo1oAo?si=1Q-9U2b9zonMg8UL',     // ดูและจัดการแผนของฉัน
  };

  // 🧩 ตรวจสอบว่า element สำคัญมีครบหรือไม่
  if (!helpBtn || !helpModal || !helpClose || !helpTopics || !helpVideo) {
    console.warn('[HELP] Missing one or more elements.');
    return;
  }

  // --- เปิด Help Modal ---
  helpBtn.addEventListener('click', e => {
    e.preventDefault();
    helpModal.classList.add('active');

    // โหลดหัวข้อแรก (intro)
    const defaultTopic = 'intro';
    helpTopics.querySelectorAll('li').forEach(li => li.classList.remove('active'));
    const firstLi = helpTopics.querySelector(`li[data-topic="${defaultTopic}"]`);
    if (firstLi) firstLi.classList.add('active');

    const defaultLink = helpLinks[defaultTopic];
    if (defaultLink && helpVideo) helpVideo.src = defaultLink;
  });

  // --- ปิด Help Modal ---
  helpClose.addEventListener('click', () => {
    helpModal.classList.remove('active');
    if (helpVideo) helpVideo.src = ''; // หยุดวิดีโอ
  });

  // --- เมื่อคลิกเปลี่ยนหัวข้อใน sidebar ---
  helpTopics.addEventListener('click', e => {
    const target = (e.target as HTMLElement).closest('li');
    if (!target || !target.dataset.topic) return;

    // เปลี่ยนสถานะ active
    helpTopics.querySelectorAll('li').forEach(li => li.classList.remove('active'));
    target.classList.add('active');

    // โหลดวิดีโอใหม่
    const topicKey = target.dataset.topic;
    const videoLink = helpLinks[topicKey];
    if (videoLink && helpVideo) {
      helpVideo.src = videoLink;
      console.log(`[HELP] Switched topic: ${topicKey}`);
    } else {
      console.warn(`[HELP] Missing video for topic: ${topicKey}`);
    }
  });

  // --- ปิดโมดอลเมื่อคลิกนอกกล่อง ---
  helpModal.addEventListener('click', e => {
    if (e.target === helpModal) {
      helpModal.classList.remove('active');
      if (helpVideo) helpVideo.src = '';
    }
  });
}

// 🚀 โหลดเมื่อ DOM พร้อม
document.addEventListener('DOMContentLoaded', initHelpModal);

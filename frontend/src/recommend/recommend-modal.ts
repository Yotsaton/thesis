// src/recommend/recommend-modal.ts
import { fetchRecommendationsFromAPI, type PlaceRecommendation } from './recommender.js';
import { showDaySelectionPopup } from '../pages/planner/index.js';

const modal = document.getElementById('recommend-modal');
const closeBtn = document.getElementById('recommend-close');
const provinceInput = document.getElementById('province-input') as HTMLInputElement | null;
const chipsContainer = document.getElementById('province-chips');
const suggestionsContainer = document.getElementById('province-suggestions');
const resultEl = document.getElementById('recommend-results');

// ✅ modal สำหรับคำอธิบาย
const descModal = document.getElementById('desc-modal');
const descTitle = document.getElementById('desc-title');
const descText = document.getElementById('desc-text');
const descClose = document.getElementById('desc-close');

const PROVINCES_TH: string[] = [
  'กระบี่', 'กรุงเทพมหานคร', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
  'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา',
  'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
  'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์',
  'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี',
  'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร',
  'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู',
  'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี'
];

let selectedProvinces: string[] = [];

// ✅ Render chips
function renderChips(): void {
  if (!chipsContainer) return;
  chipsContainer.innerHTML = '';
  selectedProvinces.forEach((province, idx) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${province} <i class="bx bx-x"></i>`;
    chip.querySelector('i')?.addEventListener('click', () => {
      selectedProvinces.splice(idx, 1);
      renderChips();
      renderResults();
    });
    chipsContainer.appendChild(chip);
  });
}

// ✅ Render result list (new design)
async function renderResults(): Promise<void> {
  if (!resultEl) return;
  if (selectedProvinces.length === 0) {
    resultEl.innerHTML = `<div class="rec-empty">โปรดเลือกจังหวัดเพื่อดูสถานที่แนะนำ</div>`;
    return;
  }

  resultEl.innerHTML = `<div class="rec-loading">กำลังดึงข้อมูล...</div>`;

  try {
    const places = await fetchRecommendationsFromAPI(selectedProvinces, ['tourist_attraction'], 30);
    if (!places.length) {
      resultEl.innerHTML = `<div class="rec-empty">ไม่พบสถานที่แนะนำในจังหวัดที่เลือก</div>`;
      return;
    }

    const listHTML = await Promise.all(
      places.map(async (p) => {
        const imgSrc = await getPlacePhoto(p.place_id);
        const name = p.name ?? '(ไม่ทราบชื่อ)';
        const province = extractProvince(p.address);
        const ratingText = p.rating
          ? `★ ${p.rating.toFixed(1)} (${p.rating_count || 0})`
          : 'ไม่มีคะแนน';
        const categories = p.categories?.join(', ') || 'หมวดหมู่ทั่วไป';

        return `
          <div class="rec-card">
            <div class="rec-thumb">
              ${imgSrc
                ? `<img src="${imgSrc}" alt="${name}" loading="lazy" />`
                : `<div class="no-photo">🏞️</div>`}
            </div>
            <div class="rec-info">
              <h4 class="rec-name">${name}</h4>
              <div class="rec-sub">${ratingText}</div>
              <div class="rec-cat">${categories}</div>
              <div class="rec-actions">
                <button class="rec-add" data-pid="${p.place_id}" data-name="${name}" data-addr="${province}">
                  <i class='bx bx-plus'></i> Add
                </button>

                ${p.detail ? `
                <button class="rec-detail" data-name="${name}" data-detail="${p.detail}">
                  <i class='bx bx-info-circle'></i> Info
                </button>` : ''}

                ${p.url ? `
                <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="rec-map">
                  <i class='bx bx-map'></i> Map
                </a>` : ''}
              </div>
            </div>
          </div>
        `;
      })
    );

    // 🧱 ใช้ class เดิมเพื่อให้ตรงกับ CSS
    resultEl.innerHTML = `
      <div class="recommend-results">
        ${listHTML.join('')}
      </div>
    `;

    // ปุ่มเพิ่ม
    resultEl.querySelectorAll<HTMLButtonElement>('.rec-add').forEach((btn) => {
      btn.onclick = () => {
        const pid = btn.dataset.pid!;
        const name = btn.dataset.name!;
        const province = btn.dataset.addr!;
        showDaySelectionPopup(name, 0, 0, pid);
        if (modal) modal.classList.remove('active');
      };
    });

    // ปุ่มรายละเอียด
    resultEl.querySelectorAll<HTMLButtonElement>('.rec-detail').forEach((btn) => {
      btn.onclick = () => {
        if (!descModal || !descTitle || !descText) return;
        descTitle.textContent = btn.dataset.name || 'รายละเอียดสถานที่';
        descText.textContent = btn.dataset.detail || 'ไม่มีคำอธิบายสำหรับสถานที่นี้';
        descModal.classList.add('active');
      };
    });

  } catch (err) {
    console.error('[recommend-modal] renderResults failed:', err);
    resultEl.innerHTML = `<div class="rec-empty">เกิดข้อผิดพลาดในการดึงข้อมูล</div>`;
  }
}

// ✅ Helper: extract province from address
function extractProvince(address: string | null): string {
  if (!address) return '';
  const parts = address.split(' ');
  return parts[parts.length - 1];
}

// ✅ Helper: fetch real photo from Google Places
async function getPlacePhoto(placeId: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!window.google?.maps?.places) {
      console.warn("Google Maps Places library not ready.");
      resolve(null);
      return;
    }

    const map = document.createElement("div");
    const service = new google.maps.places.PlacesService(map);

    service.getDetails(
      { placeId, fields: ["photos"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.photos?.length) {
          const url = place.photos[0].getUrl({ maxWidth: 400 });
          resolve(url);
        } else {
          resolve(null);
        }
      }
    );
  });
}

// ✅ Province selection logic
function selectProvince(province: string): void {
  if (!selectedProvinces.includes(province)) selectedProvinces.push(province);
  if (provinceInput) provinceInput.value = '';
  if (suggestionsContainer) suggestionsContainer.style.display = 'none';
  renderChips();
  renderResults();
}

function renderSuggestions(inputValue: string): void {
  if (!suggestionsContainer) return;
  if (!inputValue) {
    suggestionsContainer.style.display = 'none';
    return;
  }

  const filtered = PROVINCES_TH.filter(
    (p) => p.startsWith(inputValue) && !selectedProvinces.includes(p)
  );

  if (!filtered.length) {
    suggestionsContainer.style.display = 'none';
    return;
  }

  suggestionsContainer.innerHTML = '';
  filtered.slice(0, 5).forEach((province) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = province;
    item.onclick = () => selectProvince(province);
    suggestionsContainer.appendChild(item);
  });
  suggestionsContainer.style.display = 'block';
}

// ✅ Event listeners
if (closeBtn && modal) closeBtn.onclick = () => modal.classList.remove('active');
if (provinceInput) {
  provinceInput.addEventListener('input', () => renderSuggestions(provinceInput.value));
  document.addEventListener('click', (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!provinceInput.contains(t) && !suggestionsContainer?.contains(t)) {
      if (suggestionsContainer) suggestionsContainer.style.display = 'none';
    }
  });
}

// ✅ ปิด modal รายละเอียด
if (descClose && descModal) {
  descClose.onclick = () => descModal.classList.remove('active');
  descModal.addEventListener('click', (e) => {
    if (e.target === descModal) descModal.classList.remove('active');
  });
}

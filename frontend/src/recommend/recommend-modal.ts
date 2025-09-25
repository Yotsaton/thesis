import { loadPlacesIndex, topByProvinces } from './recommender.js';
import { fetchAndDisplayPlaceDetails } from '../components/Map.js';
import { appState } from '../state/index.js';
import { showDaySelectionPopup } from '../pages/planner/index.js';
import type { Place } from './recommender.js'; // ⬅️ 1. Import Type เข้ามา

// --- DATA ---
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

// --- DOM ELEMENTS with Types ---
const modal = document.getElementById('recommend-modal');
const closeBtn = document.getElementById('recommend-close');
const provinceInput = document.getElementById('province-input') as HTMLInputElement | null;
const chipsContainer = document.getElementById('province-chips');
const suggestionsContainer = document.getElementById('province-suggestions');
const resultEl = document.getElementById('recommend-results');

// --- STATE with Types ---
let ALL_PLACES: Place[] = [];
let selectedProvinces: string[] = [];

// --- FUNCTIONS with Types ---

function renderChips(): void {
  if (!chipsContainer) return;
  chipsContainer.innerHTML = '';
  selectedProvinces.forEach((province: string, idx: number) => {
    const chipElement = document.createElement('span');
    chipElement.className = 'chip';
    chipElement.innerHTML = `${province} <i class="bx bx-x"></i>`;
    const removeIcon = chipElement.querySelector('i');
    if (removeIcon) {
        removeIcon.onclick = () => {
            selectedProvinces.splice(idx, 1);
            renderChips();
            renderResults();
        };
    }
    chipsContainer.appendChild(chipElement);
  });
}

function createCardHtml(p: Place): string {
    const staticImg = `https://maps.googleapis.com/maps/api/staticmap?center=${p.lat},${p.lng}&zoom=13&size=280x160&markers=color:red|${p.lat},${p.lng}&key=${encodeURIComponent(window.GOOGLE_MAPS_API_KEY||'')}`;
    const ratingCount = p.rating_count || 0;
    const rating = p.rating || 0;
    return `
      <div class="rec-card">
        <img src="${staticImg}" alt="${p.name_th || ''}">
        <div class="rec-info">
          <div class="rec-title">${p.name_th || '(ไม่ทราบชื่อ)'}</div>
          <div class="rec-sub">${p.province} · ★${rating} (${ratingCount})</div>
        </div>
        <button class="rec-add" data-pid="${p.place_id}">+</button>
      </div>
    `;
}

function renderResults(): void {
  if (!resultEl) return;
  if (selectedProvinces.length === 0) {
    resultEl.innerHTML = `<div class="rec-empty">โปรดเลือกจังหวัดเพื่อดูสถานที่แนะนำ</div>`;
    return;
  }
  const topPlaces = topByProvinces(selectedProvinces, ALL_PLACES, 20);
  if (topPlaces.length === 0) {
    resultEl.innerHTML = `<div class="rec-empty">ไม่พบสถานที่แนะนำในจังหวัดที่เลือก</div>`;
    return;
  }
  resultEl.innerHTML = topPlaces.map(createCardHtml).join('');

  resultEl.querySelectorAll<HTMLButtonElement>('.rec-add').forEach(btn => {
    btn.onclick = () => {
      const pid = btn.dataset.pid; // Use .dataset for safer access
      if (!pid) return;
      const place = topPlaces.find(p => p.place_id === pid);
      if (place) {
        showDaySelectionPopup(place.name_th, place.lat, place.lng, place.place_id);
        if(modal) modal.classList.remove('active');
      } else {
        console.error('Could not find place data for place_id:', pid);
      }
    };
  });
}

function selectProvince(province: string): void {
    if (!provinceInput || !suggestionsContainer) return;
    if (!selectedProvinces.includes(province)) {
        selectedProvinces.push(province);
    }
    provinceInput.value = '';
    suggestionsContainer.style.display = 'none';
    renderChips();
    renderResults();
    provinceInput.focus();
}

function renderSuggestions(inputValue: string): void {
    if (!suggestionsContainer) return;
    if (!inputValue) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    const filteredProvinces = PROVINCES_TH.filter(p => 
        p.startsWith(inputValue) && !selectedProvinces.includes(p)
    );

    if (filteredProvinces.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }

    suggestionsContainer.innerHTML = '';
    filteredProvinces.slice(0, 5).forEach(province => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = province;
        item.onclick = () => selectProvince(province);
        suggestionsContainer.appendChild(item);
    });
    suggestionsContainer.style.display = 'block';
}

async function initialize(): Promise<void> {
  try {
    ALL_PLACES = await loadPlacesIndex();
    renderResults();
  } catch (e) {
    console.error('Load places index failed', e);
    if(resultEl) resultEl.innerHTML = `<div class="rec-empty">เกิดข้อผิดพลาดในการโหลดข้อมูลสถานที่</div>`;
  }
}

// --- EVENT LISTENERS (with null safety) ---

if (closeBtn && modal) {
  closeBtn.onclick = () => modal.classList.remove('active');
}

if (provinceInput && suggestionsContainer) {
    provinceInput.addEventListener('input', () => {
        renderSuggestions(provinceInput.value);
    });
    
    document.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!provinceInput.contains(target) && !suggestionsContainer.contains(target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

initialize();
//src/pages/my-plans/index.ts
import { getTripService } from "../../services/config.js";
import type { Trip } from "../../types.js";

// --- DOM Elements with Types ---
const gridContainer = document.getElementById('plans-grid-container');
const newPlanCard = document.getElementById('new-plan-card');
const backToPlannerBtn = document.getElementById('back-to-planner-btn');

// --- Functions with Types ---
function createPlanCard(trip: Trip): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'plan-card';

  // 🔽 1. แก้ไข: ดึงข้อมูลวันที่เริ่มและสิ้นสุด และจัดรูปแบบการแสดงผลใหม่ 🔽
  const formatDate = (dateString: string | undefined) => {
    return dateString
      ? new Date(dateString).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'ยังไม่ได้กำหนด';
  };

  const startDate = formatDate(trip.start_plan);
  const endDate = formatDate(trip.end_plan);
  const updatedAt = trip.updatedAt
    ? `แก้ไขล่าสุด: ${new Date(trip.updatedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  card.innerHTML = `
    <h2>${trip.name}</h2>
    <p class="dates"><strong>จาก:</strong> ${startDate}</p>
    <p class="dates"><strong>ถึง:</strong> ${endDate}</p>
    <p class="dates updated-date">${updatedAt}</p>
    <div class="plan-actions">
      <button class="btn-load">Load</button>
      <button class="btn-delete">Delete</button>
    </div>
  `;

  const loadButton = card.querySelector<HTMLButtonElement>('.btn-load');
  if (loadButton && trip.id) {
    loadButton.addEventListener('click', () => {
      localStorage.setItem('activeTripId', trip.id!);
      window.location.href = '/index.html';
    });
  }

  const deleteButton = card.querySelector<HTMLButtonElement>('.btn-delete');
  if (deleteButton && trip.id) {
    deleteButton.addEventListener('click', async () => {
      if (confirm(`Delete "${trip.name}" ?`)) {
        const tripService = await getTripService();
        await tripService.deleteTrip(trip.id!, trip.updatedAt as string);
        renderPlans();
      }
    });
  }
  
  return card;
}

async function renderPlans(): Promise<void> {
  if (!gridContainer || !newPlanCard) return;
  
  gridContainer.innerHTML = '';
  gridContainer.appendChild(newPlanCard);
  
  const tripService = await getTripService();
  const data = await tripService.loadTripList();

  if (data.success && data.trips && data.trips.length > 0) {
    const trips: Trip[] = data.trips;
    trips
      .sort((a, b) => 
        new Date(b.updatedAt || 0).getTime() - 
        new Date(a.updatedAt || 0).getTime()
      )
      .forEach(trip => {
        const card = createPlanCard(trip);
        gridContainer.insertBefore(card, newPlanCard);
      });
  }
}

// --- Event Listeners Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (backToPlannerBtn) {
        backToPlannerBtn.addEventListener('click', () => {
            window.location.href = '/index.html'; 
        });
    }

    if (newPlanCard) {
        newPlanCard.addEventListener('click', () => {
            localStorage.removeItem('activeTripId');
            window.location.href = '/index.html'; 
        });
    }

    renderPlans();
});
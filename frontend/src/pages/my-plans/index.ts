//src/pages/my-plans/index.ts
import { getTripService } from "../../services/config.js";
import type { Trip } from "../../state/index.js"; // ⬅️ 1. Import Type 'Trip' เข้ามา

// --- DOM Elements with Types ---
const gridContainer = document.getElementById('plans-grid-container');
const newPlanCard = document.getElementById('new-plan-card');
const backToPlannerBtn = document.getElementById('back-to-planner-btn');

// --- Functions with Types ---
function createPlanCard(trip: Trip): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'plan-card';

  // ใช้ Optional Chaining (?.) เพื่อความปลอดภัยหาก createdAt/updatedAt ไม่มีค่า
  const createdAt = trip.createdAt 
    ? new Date(trip.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
    : 'N/A';
  const updatedAt = trip.updatedAt 
    ? new Date(trip.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
    : 'N/A';
  
  card.innerHTML = `
    <h2>${trip.name}</h2>
    <p class="dates">Created: ${createdAt}</p>
    <p class="dates">Last updated: ${updatedAt}</p>
    <div class="plan-actions">
      <button class="btn-load">Load</button>
      <button class="btn-delete">Delete</button>
    </div>
  `;

  const loadButton = card.querySelector<HTMLButtonElement>('.btn-load');
  if (loadButton && trip._id) {
    loadButton.addEventListener('click', () => {
      localStorage.setItem('activeTripId', trip._id!); // ใช้ Non-null assertion (!) เพราะเราเช็คแล้วว่า trip._id มีค่า
      window.location.href = '/my-plans.html'; // Path ที่ถูกต้องสำหรับ Vite
    });
  }

  const deleteButton = card.querySelector<HTMLButtonElement>('.btn-delete');
  if (deleteButton && trip._id) {
    deleteButton.addEventListener('click', async () => {
      if (confirm(`Delete "${trip.name}" ?`)) {
        const tripService = await getTripService();
        await tripService.deleteTrip(trip._id!);
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
        new Date(b.updatedAt || b.createdAt || 0).getTime() - 
        new Date(a.updatedAt || a.createdAt || 0).getTime()
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
            // Path ที่ถูกต้องสำหรับ Vite
            window.location.href = '/index.html'; 
        });
    }

    if (newPlanCard) {
        newPlanCard.addEventListener('click', () => {
            localStorage.removeItem('activeTripId');
            // Path ที่ถูกต้องสำหรับ Vite
            window.location.href = '/index.html'; 
        });
    }

    renderPlans();
});
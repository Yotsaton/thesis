//  src/pages/my-plans/index.js
import { getTripService } from "../../services/config.js";

const gridContainer = document.getElementById('plans-grid-container');
const newPlanCard = document.getElementById('new-plan-card');
const backToPlannerBtn = document.getElementById('back-to-planner-btn');

function createPlanCard(trip) {
  const card = document.createElement('div');
  card.className = 'plan-card';
  const createdAt = trip.createdAt ? new Date(trip.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
  const updatedAt = trip.updatedAt ? new Date(trip.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
  card.innerHTML = `
    <h2>${trip.name}</h2>
    <p class="dates">Created: ${createdAt}</p>
    <p class="dates">Last updated: ${updatedAt}</p>
    <div class="plan-actions">
      <button class="btn-load">Load</button>
      <button class="btn-delete">Delete</button>
    </div>
  `;
  card.querySelector('.btn-load').addEventListener('click', () => {
    localStorage.setItem('activeTripId', trip._id);
    window.location.href = '/public/index.html';
  });
  card.querySelector('.btn-delete').addEventListener('click', async () => {
    if (confirm(`Delete "${trip.name}" ?`)) {
      const tripService = await getTripService();
      await tripService.deleteTrip(trip._id);
      renderPlans();
    }
  });
  return card;
}

async function renderPlans() {
  if (!gridContainer || !newPlanCard) return;
  gridContainer.innerHTML = '';
  gridContainer.appendChild(newPlanCard);
  
  const tripService = await getTripService();
  const data = await tripService.loadTripList();

  if (data.success && data.trips && data.trips.length > 0) {
    data.trips
      .sort((a,b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .forEach(trip => {
        const card = createPlanCard(trip);
        gridContainer.insertBefore(card, newPlanCard);
      });
  }
}

document.addEventListener('DOMContentLoaded', () => {
    // ผูก Event Listener กับปุ่มต่างๆ
    if (backToPlannerBtn) {
        backToPlannerBtn.addEventListener('click', () => {
            const last = localStorage.getItem('activeTripId');
            if (!last) {
                localStorage.removeItem('activeTripId');
            }
            window.location.href = '/public/index.html';
        });
    }

    if (newPlanCard) {
        newPlanCard.addEventListener('click', () => {
            localStorage.removeItem('activeTripId');
            window.location.href = '/public/index.html';
        });
    }

    // เริ่มการแสดงผลแผนทั้งหมด
    renderPlans();
});
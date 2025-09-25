import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js';
import { handleAppRender } from '../pages/planner/index.js';
import { escapeHtml, debounce } from '../helpers/utils.js';

const debouncedSave = debounce(async () => {
    try {
        const tripService = await getTripService();
        await tripService.saveCurrentTrip();
    } catch (error) {
        console.error("Failed to save note:", error);
    }
}, 500);

export function createNoteCardElement(note, itemIndex, dayIndex) {
  const noteCard = document.createElement('div');
  noteCard.className = 'note-box';
  noteCard.innerHTML = `
    <div class="note-header">
      <i class='bx bx-note'></i>
      <span>Note</span>
      <button class="del-note-btn" title="Delete Item"><i class='bx bx-x'></i></button>
    </div>
    <textarea class="note-text" placeholder="Write your notes here...">${escapeHtml(note.text)}</textarea>
  `;

  const deleteButton = noteCard.querySelector('.del-note-btn');
  deleteButton.addEventListener('click', async () => {
    appState.currentTrip.days[dayIndex].items.splice(itemIndex, 1);
    const tripService = await getTripService();
    await tripService.saveCurrentTrip();
    handleAppRender();
  });

  const textArea = noteCard.querySelector('.note-text');
  textArea.addEventListener('input', (e) => {
    appState.currentTrip.days[dayIndex].items[itemIndex].text = e.target.value;
    debouncedSave();
  });

  return noteCard;
}
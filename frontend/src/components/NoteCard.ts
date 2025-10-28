import { appState, triggerAutoSave } from '../state/index.js';
import { handleAppRender } from '../pages/planner/index.js';
import { escapeHtml, debounce } from '../helpers/utils.js';
import type { NoteItem, DayItem } from '../types.js';

// ✅ ใช้ autosave system กลางแทน tripService
const debouncedAutoSave = debounce(() => {
  triggerAutoSave(600);
}, 500);

export function createNoteCardElement(note: NoteItem, itemIndex: number, dayIndex: number): HTMLDivElement {
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

  const deleteButton = noteCard.querySelector<HTMLButtonElement>('.del-note-btn');
  if (deleteButton) {
    deleteButton.addEventListener('click', () => {
      appState.currentTrip.days[dayIndex].items.splice(itemIndex, 1);
      triggerAutoSave(800);
      handleAppRender();
    });
  }

  const textArea = noteCard.querySelector<HTMLTextAreaElement>('.note-text');
  if (textArea) {
    textArea.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLTextAreaElement;
      const item: DayItem | undefined = appState.currentTrip.days[dayIndex].items[itemIndex];
      if (item && item.type === 'note') {
        item.text = target.value;
        debouncedAutoSave();
      }
    });
  }

  return noteCard;
}

// src/components/NoteCard.ts
import { appState } from '../state/index.js';
import { getTripService } from '../services/config.js';
import { handleAppRender } from '../pages/planner/index.js';
import { escapeHtml, debounce } from '../helpers/utils.js';
// 🔽 1. แก้ไข: import Type ทั้งหมดมาจากที่ใหม่ที่เดียว 🔽
import type { NoteItem, DayItem } from '../types.js';

const debouncedSave = debounce(async () => {
    try {
        const tripService = await getTripService();
        await tripService.saveCurrentTrip();
    } catch (error) {
        console.error("Failed to save note:", error);
    }
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
    deleteButton.addEventListener('click', async () => {
      appState.currentTrip.days[dayIndex].items.splice(itemIndex, 1);
      const tripService = await getTripService();
      await tripService.saveCurrentTrip();
      handleAppRender();
    });
  }

  const textArea = noteCard.querySelector<HTMLTextAreaElement>('.note-text');
  if (textArea) {
    textArea.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLTextAreaElement;
      const item: DayItem | undefined = appState.currentTrip.days[dayIndex].items[itemIndex];
      
      // 🔽 2. เพิ่ม Type Guard เพื่อตรวจสอบให้แน่ใจว่าเป็น NoteItem 🔽
      if (item && item.type === 'note') {
        item.text = target.value;
        debouncedSave();
      }
    });
  }

  return noteCard;
}
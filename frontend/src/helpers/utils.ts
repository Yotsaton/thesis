export const TRIP_COLORS: string[] = [
  '#ffadad', '#ffd6a5', '#fdffb6', '#caffbf',
  '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'
];

export function formatDayLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US',{ weekday:'short', month:'numeric', day:'numeric' });
}

export function prettyDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long' });
}

export function escapeHtml(s: string | null | undefined): string {
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
}

// Using generics to make debounce type-safe for any function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
}
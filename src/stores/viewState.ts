export type View = { zoom: number; panX: number; panY: number };

const KEY = 'mc-pm-views';
const DEBOUNCE_MS = 300;

let pending: Record<string, View> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function readBlob(): Record<string, View> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, View>;
    return {};
  } catch {
    return {};
  }
}

function isValidView(v: unknown): v is View {
  return (
    !!v && typeof v === 'object'
    && typeof (v as View).zoom === 'number'
    && typeof (v as View).panX === 'number'
    && typeof (v as View).panY === 'number'
  );
}

function flush(): void {
  if (!pending) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(pending));
  } catch (err) {
    console.warn('viewState save failed', err);
  }
  pending = null;
  if (timer) { clearTimeout(timer); timer = null; }
}

function scheduleFlush(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

export function loadView(paintingId: string): View | null {
  const blob = pending ?? readBlob();
  const v = blob[paintingId];
  return isValidView(v) ? v : null;
}

export function saveView(paintingId: string, view: View): void {
  if (!pending) pending = readBlob();
  pending[paintingId] = view;
  scheduleFlush();
}

export function clearView(paintingId: string): void {
  if (!pending) pending = readBlob();
  delete pending[paintingId];
  scheduleFlush();
}

export function flushPendingSaves(): void {
  flush();
}

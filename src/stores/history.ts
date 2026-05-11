import { writable, type Readable, type Writable } from 'svelte/store';
import type { ProjectState } from '../paintings/types';

// Maximum entries kept in the past stack. Older entries are dropped FIFO.
const MAX_HISTORY = 100;

// Time window inside which consecutive changes are treated as a single user
// gesture and collapsed onto the same undo step. Tuned for the typing burst
// produced by number inputs (width/height/etc) without merging genuinely
// separate clicks.
const COALESCE_MS = 500;

export type HistoryController = {
  undo: () => void;
  redo: () => void;
  reset: (current: ProjectState) => void;
  canUndo: Readable<boolean>;
  canRedo: Readable<boolean>;
  destroy: () => void;
};

// Wire the given project store to an undo/redo stack. Recording starts with
// the value the store currently holds: that snapshot is treated as the
// baseline and is NOT pushed onto `past`. Callers should therefore set the
// store to its desired starting state (e.g. loaded from localStorage) before
// invoking this function.
export function createHistory(
  store: Writable<ProjectState>,
  now: () => number = () => performance.now(),
): HistoryController {
  const past: ProjectState[] = [];
  const future: ProjectState[] = [];

  const canUndo = writable(false);
  const canRedo = writable(false);

  // Suppresses the next subscription callback. Set whenever WE programmatically
  // mutate the store (undo/redo) so the resulting subscription tick does not
  // record itself as a fresh user edit.
  let suppress = false;

  // The store value we last observed. Used as the snapshot to push onto `past`
  // when the next change comes in.
  let previous: ProjectState | null = null;

  // Timestamp of the most recent observed mutation, used by coalescing.
  let lastChangeAt = 0;

  function updateFlags(): void {
    canUndo.set(past.length > 0);
    canRedo.set(future.length > 0);
  }

  function pushPast(snapshot: ProjectState): void {
    past.push(snapshot);
    if (past.length > MAX_HISTORY) past.shift();
  }

  const unsubscribe = store.subscribe((current) => {
    if (previous === null) {
      previous = current;
      return;
    }
    if (current === previous) {
      // A no-op set still consumes the suppress flag - otherwise it would
      // leak forward and swallow the next legitimate edit.
      suppress = false;
      return;
    }
    if (suppress) {
      suppress = false;
      previous = current;
      return;
    }
    const t = now();
    const withinBurst = t - lastChangeAt < COALESCE_MS && past.length > 0;
    if (!withinBurst) {
      pushPast(previous);
      future.length = 0;
      updateFlags();
    }
    previous = current;
    lastChangeAt = t;
  });

  function undo(): void {
    if (past.length === 0 || previous === null) return;
    const target = past.pop()!;
    future.push(previous);
    suppress = true;
    // Invalidate coalescing so the next user edit always records cleanly.
    lastChangeAt = 0;
    store.set(target);
    updateFlags();
  }

  function redo(): void {
    if (future.length === 0 || previous === null) return;
    const target = future.pop()!;
    pushPast(previous);
    suppress = true;
    lastChangeAt = 0;
    store.set(target);
    updateFlags();
  }

  // Wipe both stacks and re-baseline on the given snapshot. Use after a
  // destructive load (e.g. project import) where prior history would no
  // longer be meaningful.
  function reset(current: ProjectState): void {
    past.length = 0;
    future.length = 0;
    previous = current;
    lastChangeAt = 0;
    updateFlags();
  }

  return { undo, redo, reset, canUndo, canRedo, destroy: unsubscribe };
}

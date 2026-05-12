# Canvas Zoom & Pan Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add zoom and pan to the `PaintingEditor` canvas with on-screen toolbar, mouse-wheel, trackpad pinch, and keyboard input; persist per-painting view state in localStorage separate from the project JSON.

**Architecture:** A pure-TS module (`zoomMath.ts`) owns the geometry (bounds, fit, zoom-at-point, pan clamp). A separate store (`viewState.ts`) handles localStorage with debounced writes. A new `CanvasToolbar.svelte` is a thin presentational component. `PaintingEditor.svelte` keeps `basePps = 12` constant and replaces its previous `pps` constant with a reactive `pps = basePps * zoom`. Stage drag is always on; image drag continues to work because Konva resolves drag targets bottom-up.

**Tech Stack:** Svelte 5 + Konva 9 + TypeScript + Vitest. No new dependencies.

---

## File Structure

- **Create** `src/editor/zoomMath.ts` — pure functions: `computeZoomBounds`, `fitView`, `zoomAtPoint`, `clampPan`. Zero Konva imports.
- **Create** `src/editor/zoomMath.test.ts` — vitest unit tests.
- **Create** `src/stores/viewState.ts` — load/save/clear view per painting id in localStorage, debounced.
- **Create** `src/stores/viewState.test.ts` — vitest unit tests.
- **Create** `src/ui/CanvasToolbar.svelte` — presentational; emits callbacks.
- **Modify** `src/editor/PaintingEditor.svelte` — replace fixed `pps` with derived; add zoom/pan state, wheel/keyboard/resize handlers, mount the toolbar.
- **Modify** `src/ui/Sidebar.svelte` — call `clearView(id)` in the `remove` handler.

---

### Task 1: Pure zoom math module

**Files:**
- Create: `src/editor/zoomMath.ts`
- Create: `src/editor/zoomMath.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/editor/zoomMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeZoomBounds, fitView, zoomAtPoint, clampPan } from './zoomMath';

describe('computeZoomBounds', () => {
  it('caps minZoom at 1 when the canvas already fits comfortably', () => {
    // 1x1 block (16 source units) at basePps 12 = 192px; host 1000x1000 fits easily.
    const b = computeZoomBounds(16, 16, 1000, 1000, 12);
    expect(b.minZoom).toBe(1);
    expect(b.maxZoom).toBe(8);
  });

  it('picks the limiting axis when the canvas does not fit', () => {
    // 4x1 blocks = 64x16 source; basePps 12 -> 768x192. Host 400x800.
    // fitX = (400 - 64) / 768 ≈ 0.4375; fitY = (800 - 64) / 192 ≈ 3.833.
    // limited by X, so fitZoom ≈ 0.4375. minZoom = min(0.4375, 1) = 0.4375.
    const b = computeZoomBounds(64, 16, 400, 800, 12);
    expect(b.minZoom).toBeCloseTo((400 - 64) / (64 * 12), 5);
    expect(b.maxZoom).toBe(8);
  });
});

describe('fitView', () => {
  it('centers the canvas in the host at the fit zoom', () => {
    const v = fitView(16, 16, 1000, 600, 12);
    // fitZoom = min((1000-64)/192, (600-64)/192) = (600-64)/192 ≈ 2.79, clamped to maxZoom 8 → 2.79.
    // But minZoom = min(fitZoom, 1) = 1; fitView returns zoom = clamp(fitZoom, minZoom, maxZoom) = 2.79.
    expect(v.zoom).toBeCloseTo((600 - 64) / (16 * 12), 5);
    const canvasPx = 16 * 12 * v.zoom;
    expect(v.panX).toBeCloseTo((1000 - canvasPx) / 2, 5);
    expect(v.panY).toBeCloseTo((600 - canvasPx) / 2, 5);
  });
});

describe('zoomAtPoint', () => {
  it('keeps the world point under the cursor fixed across a zoom', () => {
    const basePps = 12;
    const bounds = { minZoom: 0.1, maxZoom: 8 };
    const start = { zoom: 1, panX: 100, panY: 50 };
    const pivot = { x: 250, y: 200 };
    // World coords of the pivot before zoom:
    const worldX = (pivot.x - start.panX) / (basePps * start.zoom);
    const worldY = (pivot.y - start.panY) / (basePps * start.zoom);
    const next = zoomAtPoint(start, 2, pivot, basePps, bounds);
    expect(next.zoom).toBe(2);
    // After zoom, the same world point must still map to the same pivot.
    const newPivotX = next.panX + worldX * basePps * next.zoom;
    const newPivotY = next.panY + worldY * basePps * next.zoom;
    expect(newPivotX).toBeCloseTo(pivot.x, 5);
    expect(newPivotY).toBeCloseTo(pivot.y, 5);
  });

  it('clamps zoom at the upper bound', () => {
    const next = zoomAtPoint(
      { zoom: 4, panX: 0, panY: 0 },
      10,
      { x: 0, y: 0 },
      12,
      { minZoom: 0.5, maxZoom: 8 },
    );
    expect(next.zoom).toBe(8);
  });

  it('clamps zoom at the lower bound', () => {
    const next = zoomAtPoint(
      { zoom: 1, panX: 0, panY: 0 },
      0.01,
      { x: 0, y: 0 },
      12,
      { minZoom: 0.5, maxZoom: 8 },
    );
    expect(next.zoom).toBe(0.5);
  });
});

describe('clampPan', () => {
  it('leaves an in-bounds view untouched', () => {
    const v = { zoom: 1, panX: 100, panY: 100 };
    const c = clampPan(v, 16, 16, 1000, 1000, 12);
    expect(c).toEqual(v);
  });

  it('clamps pan so at least minVisible pixels of the canvas remain on each axis', () => {
    // Canvas 192x192 px at zoom 1; minVisible 64; host 1000x1000.
    // Pan way off-screen: panX = 2000 (canvas right edge at 2192, all off the right). Should clamp.
    const v = { zoom: 1, panX: 2000, panY: 0 };
    const c = clampPan(v, 16, 16, 1000, 1000, 12, 64);
    // After clamp: panX + canvasW = 192 + panX must be >= 64, i.e. panX >= -128 (canvas extends past left).
    // Or: panX <= hostW - 64 = 936 (canvas not fully past right). So clamped panX = 936.
    expect(c.panX).toBe(1000 - 64);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/editor/zoomMath.test.ts`

Expected: all tests fail with "Cannot find module './zoomMath'" or similar.

- [ ] **Step 3: Implement `src/editor/zoomMath.ts`**

Create the file:

```ts
export type View = { zoom: number; panX: number; panY: number };
export type Bounds = { minZoom: number; maxZoom: number };

const MAX_ZOOM = 8;
const DEFAULT_MARGIN = 32;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function computeZoomBounds(
  canvasW16: number,
  canvasH16: number,
  hostW: number,
  hostH: number,
  basePps: number,
  margin: number = DEFAULT_MARGIN,
): Bounds {
  const canvasPxW = Math.max(1, canvasW16 * basePps);
  const canvasPxH = Math.max(1, canvasH16 * basePps);
  const fitW = (hostW - 2 * margin) / canvasPxW;
  const fitH = (hostH - 2 * margin) / canvasPxH;
  const fitZoom = Math.max(0.01, Math.min(fitW, fitH));
  const minZoom = Math.min(fitZoom, 1);
  return { minZoom, maxZoom: MAX_ZOOM };
}

export function fitView(
  canvasW16: number,
  canvasH16: number,
  hostW: number,
  hostH: number,
  basePps: number,
  margin: number = DEFAULT_MARGIN,
): View {
  const canvasPxW = Math.max(1, canvasW16 * basePps);
  const canvasPxH = Math.max(1, canvasH16 * basePps);
  const fitW = (hostW - 2 * margin) / canvasPxW;
  const fitH = (hostH - 2 * margin) / canvasPxH;
  const bounds = computeZoomBounds(canvasW16, canvasH16, hostW, hostH, basePps, margin);
  const zoom = clamp(Math.min(fitW, fitH), bounds.minZoom, bounds.maxZoom);
  const panX = (hostW - canvasPxW * zoom) / 2;
  const panY = (hostH - canvasPxH * zoom) / 2;
  return { zoom, panX, panY };
}

export function zoomAtPoint(
  current: View,
  factor: number,
  pivot: { x: number; y: number },
  basePps: number,
  bounds: Bounds,
): View {
  const oldPps = basePps * current.zoom;
  const worldX = (pivot.x - current.panX) / oldPps;
  const worldY = (pivot.y - current.panY) / oldPps;
  const zoom = clamp(current.zoom * factor, bounds.minZoom, bounds.maxZoom);
  const newPps = basePps * zoom;
  const panX = pivot.x - worldX * newPps;
  const panY = pivot.y - worldY * newPps;
  return { zoom, panX, panY };
}

export function clampPan(
  view: View,
  canvasW16: number,
  canvasH16: number,
  hostW: number,
  hostH: number,
  basePps: number,
  minVisible: number = 64,
): View {
  const canvasPxW = canvasW16 * basePps * view.zoom;
  const canvasPxH = canvasH16 * basePps * view.zoom;
  // Keep at least minVisible px of the canvas inside the host on each axis.
  // panX upper bound: hostW - minVisible (canvas right edge >= 0 + minVisible? No: we need
  // canvas to overlap the host by >= minVisible. canvas spans [panX, panX + canvasPxW].
  // Overlap with [0, hostW] is at least minVisible iff:
  //   panX <= hostW - minVisible  AND  panX + canvasPxW >= minVisible
  // i.e. panX in [minVisible - canvasPxW, hostW - minVisible].
  const minPanX = minVisible - canvasPxW;
  const maxPanX = hostW - minVisible;
  const minPanY = minVisible - canvasPxH;
  const maxPanY = hostH - minVisible;
  return {
    zoom: view.zoom,
    panX: clamp(view.panX, Math.min(minPanX, maxPanX), Math.max(minPanX, maxPanX)),
    panY: clamp(view.panY, Math.min(minPanY, maxPanY), Math.max(minPanY, maxPanY)),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/editor/zoomMath.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/editor/zoomMath.ts src/editor/zoomMath.test.ts
git commit -m "feat(editor): pure zoom math (bounds, fit, zoom-at-point, pan clamp)"
```

---

### Task 2: View-state localStorage module

**Files:**
- Create: `src/stores/viewState.ts`
- Create: `src/stores/viewState.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/stores/viewState.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadView, saveView, clearView, flushPendingSaves } from './viewState';

const KEY = 'mc-pm-views';

beforeEach(() => {
  localStorage.clear();
});

describe('loadView', () => {
  it('returns null for an unknown painting id', () => {
    expect(loadView('nope')).toBeNull();
  });

  it('returns the saved view for a known id', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: { zoom: 2, panX: 10, panY: 20 } }));
    expect(loadView('a')).toEqual({ zoom: 2, panX: 10, panY: 20 });
  });

  it('returns null on corrupt JSON', () => {
    localStorage.setItem(KEY, '{ not json');
    expect(loadView('a')).toBeNull();
  });

  it('returns null on schema-mismatched entries', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: { zoom: 'bogus' } }));
    expect(loadView('a')).toBeNull();
  });
});

describe('saveView', () => {
  it('writes the value to localStorage after the debounce window', () => {
    vi.useFakeTimers();
    saveView('a', { zoom: 1.5, panX: 5, panY: 7 });
    expect(localStorage.getItem(KEY)).toBeNull();
    vi.advanceTimersByTime(300);
    const blob = JSON.parse(localStorage.getItem(KEY)!);
    expect(blob.a).toEqual({ zoom: 1.5, panX: 5, panY: 7 });
    vi.useRealTimers();
  });

  it('merges multiple ids in the same storage blob', () => {
    vi.useFakeTimers();
    saveView('a', { zoom: 1, panX: 0, panY: 0 });
    saveView('b', { zoom: 2, panX: 1, panY: 1 });
    vi.advanceTimersByTime(300);
    const blob = JSON.parse(localStorage.getItem(KEY)!);
    expect(blob.a).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(blob.b).toEqual({ zoom: 2, panX: 1, panY: 1 });
    vi.useRealTimers();
  });
});

describe('clearView', () => {
  it('removes only the requested id', () => {
    vi.useFakeTimers();
    saveView('a', { zoom: 1, panX: 0, panY: 0 });
    saveView('b', { zoom: 2, panX: 0, panY: 0 });
    vi.advanceTimersByTime(300);
    clearView('a');
    flushPendingSaves();
    const blob = JSON.parse(localStorage.getItem(KEY)!);
    expect(blob.a).toBeUndefined();
    expect(blob.b).toEqual({ zoom: 2, panX: 0, panY: 0 });
    vi.useRealTimers();
  });
});

describe('flushPendingSaves', () => {
  it('forces an immediate write of pending changes', () => {
    saveView('a', { zoom: 3, panX: 4, panY: 5 });
    flushPendingSaves();
    const blob = JSON.parse(localStorage.getItem(KEY)!);
    expect(blob.a).toEqual({ zoom: 3, panX: 4, panY: 5 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/stores/viewState.test.ts`

Expected: all tests fail because the module does not exist yet.

- [ ] **Step 3: Implement `src/stores/viewState.ts`**

Create the file:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/stores/viewState.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/viewState.ts src/stores/viewState.test.ts
git commit -m "feat(stores): per-painting view state in localStorage with debounced writes"
```

---

### Task 3: Canvas toolbar component

**Files:**
- Create: `src/ui/CanvasToolbar.svelte`

No unit tests for this component (presentational; the integration is verified in Task 4 and the manual checklist).

- [ ] **Step 1: Create the component**

Create `src/ui/CanvasToolbar.svelte`:

```svelte
<script lang="ts">
  export let zoom: number;
  export let minZoom: number;
  export let maxZoom: number;
  export let onZoomIn: () => void;
  export let onZoomOut: () => void;
  export let onSetZoom: (z: number) => void;
  export let onFit: () => void;
  export let onResetOneToOne: () => void;

  const PRESETS = [0.25, 0.5, 0.75, 1, 2, 4, 8];

  let menuOpen = false;
  $: pct = Math.round(zoom * 100);
  $: canZoomIn = zoom < maxZoom - 1e-6;
  $: canZoomOut = zoom > minZoom + 1e-6;
  $: availablePresets = PRESETS.filter((z) => z >= minZoom - 1e-6 && z <= maxZoom + 1e-6);

  function toggleMenu() { menuOpen = !menuOpen; }
  function pick(z: number) { menuOpen = false; onSetZoom(z); }
  function onMenuKey(e: KeyboardEvent) { if (e.key === 'Escape') menuOpen = false; }
</script>

<div class="toolbar" role="toolbar" aria-label="Canvas controls">
  <button type="button" class="btn" disabled={!canZoomOut} on:click={onZoomOut} title="Zoom out (-)">−</button>

  <div class="zoom-display">
    <button type="button" class="pct" on:click={toggleMenu} aria-haspopup="menu" aria-expanded={menuOpen} title="Zoom presets">
      {pct}% <span aria-hidden="true">▾</span>
    </button>
    {#if menuOpen}
      <ul class="menu" role="menu" on:keydown={onMenuKey}>
        {#each availablePresets as p}
          <li role="menuitem">
            <button type="button" class="preset" on:click={() => pick(p)}>{Math.round(p * 100)}%</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <button type="button" class="btn" disabled={!canZoomIn} on:click={onZoomIn} title="Zoom in (+)">+</button>

  <span class="sep" aria-hidden="true"></span>

  <button type="button" class="btn label" on:click={onFit} title="Fit to screen (0)">
    <span class="icon" aria-hidden="true">⛶</span><span class="text">Fit</span>
  </button>
  <button type="button" class="btn label" on:click={onResetOneToOne} title="Actual size (1)">
    <span class="text">1:1</span>
  </button>
</div>

<style>
  .toolbar {
    position: absolute;
    right: var(--space-5);
    bottom: var(--space-5);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    z-index: 10;
    user-select: none;
  }
  .btn {
    min-width: 32px; height: 32px;
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text);
    font-size: var(--fs-md);
    line-height: 1;
    cursor: pointer;
  }
  .btn:hover:not(:disabled) { background: var(--surface); border-color: var(--border); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .label { display: inline-flex; align-items: center; gap: var(--space-2); }
  .icon { font-size: var(--fs-lg); }
  .sep { width: 1px; height: 20px; background: var(--border); margin: 0 var(--space-1); }
  .zoom-display { position: relative; }
  .pct {
    min-width: 64px; height: 32px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    font-size: var(--fs-sm);
    cursor: pointer;
  }
  .pct:hover { background: #fff; }
  .menu {
    position: absolute; right: 0; bottom: calc(100% + 4px);
    list-style: none; margin: 0; padding: var(--space-1);
    background: #fff; border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow); min-width: 88px;
  }
  .preset {
    width: 100%; text-align: right; padding: 4px 8px;
    border: 0; background: transparent; border-radius: var(--radius-sm);
    font-size: var(--fs-sm); cursor: pointer;
  }
  .preset:hover { background: var(--surface); }
  @media (max-width: 480px) {
    .label .text { display: none; }
  }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`

Expected: no errors related to `CanvasToolbar.svelte`. (Pre-existing warnings in unrelated files are acceptable.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/CanvasToolbar.svelte
git commit -m "feat(ui): canvas toolbar with zoom buttons, presets, fit, 1:1"
```

---

### Task 4: Wire zoom + pan state into `PaintingEditor`

This is the largest task. It replaces the fixed `pps` with a reactive derived value, adds `zoom`/`panX`/`panY` state, mounts the toolbar, and wires the toolbar callbacks. Wheel, keyboard, and ResizeObserver are deferred to Task 5 so this task stays reviewable.

**Files:**
- Modify: `src/editor/PaintingEditor.svelte`

- [ ] **Step 1: Replace the script block top section**

Open `src/editor/PaintingEditor.svelte`. Replace the existing script block (lines 1-50, ending with the `onDestroy` line) with:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Konva from 'konva';
  import { project } from '../stores/project';
  import { rasterizeForPreview } from './previewRaster';
  import { computeZoomBounds, fitView, zoomAtPoint, clampPan, type View } from './zoomMath';
  import { loadView, saveView, clearView, flushPendingSaves } from '../stores/viewState';
  import CanvasToolbar from '../ui/CanvasToolbar.svelte';
  import type { Painting } from '../paintings/types';

  export let id: string;

  let host: HTMLDivElement;
  let stage: Konva.Stage | null = null;
  let bgLayer: Konva.Layer;
  let imageLayer: Konva.Layer;
  let gridLayer: Konva.Layer;
  let imageNode: Konva.Image | null = null;
  let rasterLayer: Konva.Layer;
  let rasterImageNode: Konva.Image | null = null;
  let overlayLayer: Konva.Layer;
  let overlayRects: { top: Konva.Rect; bottom: Konva.Rect; left: Konva.Rect; right: Konva.Rect } | null = null;
  let cachedRasterImg: HTMLImageElement | null = null;
  let rasterToken = 0;
  let rasterSig = '';
  let mode: 'live' | 'settled' = 'settled';

  const basePps = 12;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  $: pps = basePps * zoom;
  $: bounds = stage
    ? computeZoomBounds(painting?.canvasW16 ?? 16, painting?.canvasH16 ?? 16, stage.width(), stage.height(), basePps)
    : { minZoom: 0.1, maxZoom: 8 };

  function currentRasterSig(p: Painting): string {
    const t = p.transform;
    const s = p.source;
    return [
      p.canvasW16, p.canvasH16, p.textureDensity, p.resampling,
      t.x16, t.y16, t.w16, t.h16, t.rotation, t.flipX, t.flipY,
      s ? s.pngBase64.length : 0, s ? s.naturalW : 0, s ? s.naturalH : 0,
    ].join(':');
  }

  $: painting = $project.paintings.find((p) => p.id === id) ?? null;

  onMount(async () => {
    stage = new Konva.Stage({ container: host, width: host.clientWidth, height: host.clientHeight });
    bgLayer = new Konva.Layer();
    imageLayer = new Konva.Layer();
    gridLayer = new Konva.Layer();
    rasterLayer = new Konva.Layer();
    overlayLayer = new Konva.Layer({ listening: false });
    stage.add(bgLayer, imageLayer, rasterLayer, overlayLayer, gridLayer);
    stage.draggable(true);
    stage.on('dragend', onStageDragEnd);
    initView();
    await refresh();
  });

  onDestroy(() => {
    flushPendingSaves();
    stage?.destroy();
  });
</script>
```

- [ ] **Step 2: Add `initView` and pan-related helpers**

After the `onDestroy` block, before `async function refresh()`, add:

```ts
  function initView() {
    if (!stage || !painting) return;
    const hostW = stage.width();
    const hostH = stage.height();
    const saved = loadView(id);
    if (saved) {
      const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, hostW, hostH, basePps);
      const clampedZoom = Math.max(b.minZoom, Math.min(b.maxZoom, saved.zoom));
      const clamped = clampPan(
        { zoom: clampedZoom, panX: saved.panX, panY: saved.panY },
        painting.canvasW16, painting.canvasH16, hostW, hostH, basePps,
      );
      zoom = clamped.zoom; panX = clamped.panX; panY = clamped.panY;
    } else {
      const v = fitView(painting.canvasW16, painting.canvasH16, hostW, hostH, basePps);
      zoom = v.zoom; panX = v.panX; panY = v.panY;
    }
  }

  function applyView() {
    if (!stage) return;
    stage.position({ x: panX, y: panY });
  }

  function persistView() {
    saveView(id, { zoom, panX, panY });
  }

  function onStageDragEnd() {
    if (!stage) return;
    const pos = stage.position();
    if (!painting) return;
    const clamped = clampPan(
      { zoom, panX: pos.x, panY: pos.y },
      painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps,
    );
    panX = clamped.panX; panY = clamped.panY;
    applyView();
    persistView();
  }

  function setZoom(nextZoom: number, pivot?: { x: number; y: number }) {
    if (!stage || !painting) return;
    const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    const px = pivot?.x ?? stage.width() / 2;
    const py = pivot?.y ?? stage.height() / 2;
    const factor = Math.max(b.minZoom, Math.min(b.maxZoom, nextZoom)) / zoom;
    const next: View = zoomAtPoint({ zoom, panX, panY }, factor, { x: px, y: py }, basePps, b);
    const clamped = clampPan(next, painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    zoom = clamped.zoom; panX = clamped.panX; panY = clamped.panY;
    persistView();
  }

  function stepZoom(direction: 1 | -1) {
    setZoom(zoom * (direction === 1 ? 1.25 : 1 / 1.25));
  }

  function onFit() {
    if (!stage || !painting) return;
    const v = fitView(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    zoom = v.zoom; panX = v.panX; panY = v.panY;
    persistView();
  }

  function onResetOneToOne() {
    if (!stage || !painting) return;
    const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    setZoom(Math.max(1, b.minZoom));
  }
```

- [ ] **Step 3: Update `refresh()` to apply the view and stop using the old centering function**

Replace the existing `refresh` function (currently around lines 52-71) with:

```ts
  async function refresh() {
    if (!stage || !painting) return;
    mode = 'settled';
    stage.size({ width: host.clientWidth, height: host.clientHeight });
    bgLayer.destroyChildren();
    imageLayer.destroyChildren();
    rasterLayer.destroyChildren();
    overlayLayer.destroyChildren();
    gridLayer.destroyChildren();
    rasterImageNode = null;
    overlayRects = null;
    drawCheckerboard();
    await drawImage();
    drawRasterPreview();
    drawOverlay();
    drawGrid();
    // Re-clamp view in case canvas dimensions or host size changed.
    const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    const reclamped = clampPan(
      { zoom: Math.max(b.minZoom, Math.min(b.maxZoom, zoom)), panX, panY },
      painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps,
    );
    zoom = reclamped.zoom; panX = reclamped.panX; panY = reclamped.panY;
    applyView();
    bgLayer.draw(); imageLayer.draw(); rasterLayer.draw(); overlayLayer.draw(); gridLayer.draw();
    maybeStartRaster();
  }
```

- [ ] **Step 4: Remove the old `centerAndConfigurePan` function**

Delete the entire `centerAndConfigurePan` function definition (currently around lines 73-82). It is no longer referenced.

- [ ] **Step 5: React to view changes**

At the bottom of the script block, before the existing `$: if (painting) refresh()...` line, add:

```ts
  $: if (stage) { applyView(); }
```

This ensures that whenever `panX/panY` change at runtime (via toolbar callbacks), the stage position updates without a full `refresh`.

- [ ] **Step 6: Render the toolbar in the template**

Replace the existing template block (lines 282-284) with:

```svelte
<div class="canvas-wrap">
  <div class="canvas-host" bind:this={host}></div>
  {#if painting && stage}
    <CanvasToolbar
      {zoom}
      minZoom={bounds.minZoom}
      maxZoom={bounds.maxZoom}
      onZoomIn={() => stepZoom(1)}
      onZoomOut={() => stepZoom(-1)}
      onSetZoom={(z) => setZoom(z)}
      {onFit}
      {onResetOneToOne}
    />
  {/if}
</div>
```

- [ ] **Step 7: Update the `.canvas-wrap` style**

Replace the existing `<style>` block at the bottom of the file with:

```svelte
<style>
  .canvas-wrap {
    flex: 1;
    padding: var(--space-7);
    background: var(--surface-2);
    min-height: 0;
    position: relative;
  }
  .canvas-host {
    width: 100%; height: 100%;
    background: #fff; border: 1px solid var(--border); border-radius: var(--radius-lg);
    overflow: hidden;
  }
</style>
```

- [ ] **Step 8: Type-check and run existing tests**

Run: `npm run check`
Expected: no new errors.

Run: `npm test`
Expected: existing tests still pass; `zoomMath` and `viewState` tests pass.

- [ ] **Step 9: Manual smoke check**

Run: `npm run dev`
Open the URL printed by Vite. Open a project (create a painting if none).

Verify:
- Toolbar visible in bottom-right of the canvas area.
- Clicking `+` / `−` zooms toward the canvas center.
- Clicking `Fit` centers and fits the canvas.
- Clicking `1:1` jumps to 100% (or `minZoom` for small viewports).
- Preset menu shows percentages and applies on click.
- Dragging an empty area of the canvas pans the stage.
- Dragging the image still moves the image (not the stage).
- Refreshing the page restores zoom and pan.

If any of these fail, fix before committing.

- [ ] **Step 10: Commit**

```bash
git add src/editor/PaintingEditor.svelte
git commit -m "feat(editor): zoom + pan state, toolbar wiring, persistent per-painting view"
```

---

### Task 5: Wheel, keyboard, and resize handlers

**Files:**
- Modify: `src/editor/PaintingEditor.svelte`

- [ ] **Step 1: Add wheel handler**

In `src/editor/PaintingEditor.svelte`, inside `onMount` after `stage.on('dragend', onStageDragEnd);` (added in Task 4), append:

```ts
    stage.on('wheel', onWheel);
```

Then add the handler. Place it near `onStageDragEnd`:

```ts
  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    if (!stage || !painting) return;
    e.evt.preventDefault();
    const ev = e.evt;
    if (ev.ctrlKey || ev.metaKey) {
      const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      const pivot = { x: ev.offsetX, y: ev.offsetY };
      const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
      const next = zoomAtPoint({ zoom, panX, panY }, factor, pivot, basePps, b);
      const clamped = clampPan(next, painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
      zoom = clamped.zoom; panX = clamped.panX; panY = clamped.panY;
    } else {
      const dx = ev.shiftKey ? ev.deltaY : ev.deltaX;
      const dy = ev.shiftKey ? 0 : ev.deltaY;
      const next = clampPan(
        { zoom, panX: panX - dx, panY: panY - dy },
        painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps,
      );
      panX = next.panX; panY = next.panY;
    }
    persistView();
  }
```

- [ ] **Step 2: Add keyboard handler**

Still inside `onMount`, append after `stage.on('wheel', onWheel);`:

```ts
    window.addEventListener('keydown', onKeyDown);
```

Add the handler near `onWheel`:

```ts
  function onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); stepZoom(-1); }
    else if (e.key === '0') { e.preventDefault(); onFit(); }
    else if (e.key === '1') { e.preventDefault(); onResetOneToOne(); }
  }
```

- [ ] **Step 3: Add ResizeObserver for host**

Add a top-level `let` near the other module-locals:

```ts
  let resizeObs: ResizeObserver | null = null;
```

Inside `onMount`, append after `window.addEventListener('keydown', onKeyDown);`:

```ts
    resizeObs = new ResizeObserver(() => { onResize(); });
    resizeObs.observe(host);
```

Add the handler:

```ts
  function onResize() {
    if (!stage || !painting) return;
    stage.size({ width: host.clientWidth, height: host.clientHeight });
    const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    const clampedZoom = Math.max(b.minZoom, Math.min(b.maxZoom, zoom));
    const clamped = clampPan(
      { zoom: clampedZoom, panX, panY },
      painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps,
    );
    zoom = clamped.zoom; panX = clamped.panX; panY = clamped.panY;
    applyView();
    persistView();
  }
```

- [ ] **Step 4: Update `onDestroy` cleanup**

Replace the existing `onDestroy` block (added in Task 4) with:

```ts
  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
    resizeObs?.disconnect();
    resizeObs = null;
    flushPendingSaves();
    stage?.destroy();
  });
```

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`

Verify:
- Ctrl + wheel zooms toward the cursor. The point under the cursor stays under the cursor across a zoom.
- Wheel without modifier pans both axes.
- Shift + wheel pans horizontally.
- Pinch gesture on a trackpad zooms (the browser maps it to `wheel + ctrlKey`).
- Keys `+`, `-`, `0`, `1` work when not focused in an input.
- Typing in an input (e.g. the painting name) does not trigger zoom shortcuts.
- Resizing the browser window does not lose the canvas; if zoom drops below `minZoom` it snaps to `minZoom`.

- [ ] **Step 7: Commit**

```bash
git add src/editor/PaintingEditor.svelte
git commit -m "feat(editor): wheel zoom/pan, keyboard shortcuts, resize observer"
```

---

### Task 6: Clear view state on painting delete

**Files:**
- Modify: `src/ui/Sidebar.svelte`

- [ ] **Step 1: Add the import**

Open `src/ui/Sidebar.svelte`. In the script block, add to the existing imports:

```ts
  import { clearView } from '../stores/viewState';
```

- [ ] **Step 2: Update `remove`**

Replace the `remove` function (around lines 43-46) with:

```ts
  function remove(id: string) {
    project.update((v) => ({ ...v, paintings: v.paintings.filter((p) => p.id !== id) }));
    clearView(id);
    if (selectedId === id) selectedId = null;
  }
```

- [ ] **Step 3: Type-check and existing tests**

Run: `npm run check`
Expected: no new errors.

Run: `npm test`
Expected: existing tests still pass. `Sidebar.test.ts` is unaffected (it does not test localStorage interactions).

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Open DevTools → Application → Local Storage.

- Create a painting, zoom in, refresh — confirm a `mc-pm-views` entry exists with the painting's id.
- Delete the painting from the sidebar — confirm the entry is removed (the key may still exist with `{}` or with other ids; only the deleted one should be gone).

- [ ] **Step 5: Commit**

```bash
git add src/ui/Sidebar.svelte
git commit -m "feat(editor): clear persisted view state when a painting is deleted"
```

---

### Task 7: Final manual verification

**Files:** none modified.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run the dev server and walk the manual checklist**

Run: `npm run dev`. Open the URL.

Walk through this checklist, fixing any failures and committing fixes as separate commits:

- [ ] Ctrl + wheel zooms; the point under the cursor stays under the cursor.
- [ ] Wheel without modifier pans on both axes.
- [ ] Shift + wheel pans horizontally.
- [ ] Pinch on a trackpad zooms (Chrome / Safari / Firefox).
- [ ] Toolbar `+` / `−` / Fit / 1:1 / preset menu work as labeled.
- [ ] Keys `+`, `-`, `0`, `1` work outside input fields.
- [ ] Typing in the painting-name input does not zoom.
- [ ] Image drag and transformer still work.
- [ ] Snap to `1/16-block` continues to hold (the committed `x16, y16, w16, h16` stay integer).
- [ ] Refreshing the page restores zoom and pan per painting.
- [ ] Switching between paintings shows each one's saved view (or fits if never opened).
- [ ] Resizing the browser window clamps zoom and pan, the canvas stays visible.
- [ ] Deleting a painting removes its entry from `mc-pm-views`.

- [ ] **Step 3: Done**

If everything passes, the feature is complete. If there were no fixes in Step 2 beyond the per-task commits, there is nothing further to commit.

---

## Self-Review Notes (for the author of this plan)

- Spec coverage: each section of the spec is implemented — zoomMath in Task 1, viewState in Task 2, toolbar in Task 3, editor wiring in Tasks 4 + 5, delete cleanup in Task 6, manual verification in Task 7.
- No placeholders; all code shown inline.
- Function names consistent across tasks: `computeZoomBounds`, `fitView`, `zoomAtPoint`, `clampPan`, `loadView`, `saveView`, `clearView`, `flushPendingSaves`, `setZoom`, `stepZoom`, `onFit`, `onResetOneToOne`, `onWheel`, `onKeyDown`, `onResize`, `onStageDragEnd`, `applyView`, `persistView`, `initView`.
- The `Space-hold pan` fallback from the spec's "Risks" section is not implemented in the plan because it is contingent on manual-testing results. If conflicts surface in Task 4 Step 9 or Task 7, add a follow-up task.

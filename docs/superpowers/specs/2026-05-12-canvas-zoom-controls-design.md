## Goal

The painting editor canvas is zoomable and pannable, with on-screen controls and keyboard / wheel / trackpad input. Per-painting view state (zoom and pan) is restored across reloads via local storage, independently from the project JSON.

## Motivation

Today `PaintingEditor.svelte` uses a fixed `pps = 12` and only enables stage drag when the canvas overflows the host. There is no way to inspect detail on a large painting or to see the whole thing at once when it does not fit. Adding zoom + pan + standard navigation controls brings the editor closer to the ergonomics users expect from any pixel / canvas tool (Figma, Photoshop, Aseprite).

## Non-goals

- No change to the painting model (`Painting` schema, `transform`, `source`, `canvasW16/H16`). View state is **not** added to `Painting`.
- No change to undo / redo. Zoom and pan are editor state, not project state.
- No change to the snap-to-`1/16-block` semantics in `imageNode.dragmove` / `commitTransform`. Snap continues to operate in source units; visual snap step in pixels scales naturally with zoom.
- No change to the rasterized preview pipeline, overlay dimming, transformer behavior, or grid rendering — those are rebuilt from `pps` on every refresh as today.
- No mobile gesture support beyond what the browser already maps to `wheel` events (pinch-to-zoom on trackpads emits `wheel` with `ctrlKey`).

## High-level design

`PaintingEditor.svelte` keeps a `basePps = 12` constant and gains three reactive state variables: `zoom`, `panX`, `panY`. The derived `pps = basePps * zoom` is what the rest of the rendering code already uses. Pan is applied as `stage.position({ x: panX, y: panY })`.

A new `CanvasToolbar.svelte` component, positioned absolutely in the bottom-right of `.canvas-wrap`, exposes zoom buttons, a zoom percentage menu, fit-to-screen, and 1:1.

A new `src/stores/viewState.ts` module stores `{ zoom, panX, panY }` per painting id in its own localStorage key (`mc-pm-views`), debounced on write.

A new `src/editor/zoomMath.ts` extracts the pure functions (`computeZoomBounds`, `zoomAtPoint`, `clampPan`, `fitView`) so they can be unit-tested without instantiating Konva.

## File changes

### New: `src/editor/zoomMath.ts`

Pure functions, no Konva imports:

```ts
export type View = { zoom: number; panX: number; panY: number };
export type Bounds = { minZoom: number; maxZoom: number };

export function computeZoomBounds(
  canvasW16: number, canvasH16: number,
  hostW: number, hostH: number,
  basePps: number, margin = 32,
): Bounds;

export function fitView(
  canvasW16: number, canvasH16: number,
  hostW: number, hostH: number,
  basePps: number, margin = 32,
): View;

export function zoomAtPoint(
  current: View,
  factor: number,
  pivot: { x: number; y: number },
  basePps: number,
  bounds: Bounds,
): View;

export function clampPan(
  view: View,
  canvasW16: number, canvasH16: number,
  hostW: number, hostH: number,
  basePps: number,
  minVisible = 64,
): View;
```

Notes:
- `computeZoomBounds`: `fitZoom = min((hostW - 2*margin) / (canvasW16*basePps), (hostH - 2*margin) / (canvasH16*basePps))`. `minZoom = min(fitZoom, 1)`. `maxZoom = 8`.
- `fitView`: zoom = the `fitZoom` from above (clamped to `[minZoom, maxZoom]`); pan centers the canvas in the host.
- `zoomAtPoint`: applies the standard "keep world point under cursor fixed" formula. World units here are "1/16 of a block", consistent with `Painting.transform`. The pivot is in viewport (host) pixels.
- `clampPan`: ensures at least `minVisible` pixels of the canvas remain inside the viewport on each axis, so the user cannot lose the canvas entirely.

### New: `src/stores/viewState.ts`

```ts
export type View = { zoom: number; panX: number; panY: number };

export function loadView(paintingId: string): View | null;
export function saveView(paintingId: string, view: View): void;  // debounced internally
export function clearView(paintingId: string): void;
export function flushPendingSaves(): void;  // called on editor onDestroy
```

- Storage key: `mc-pm-views`. Shape: `{ [paintingId]: View }`.
- Schema validation soft: malformed JSON → treat as empty, no throw.
- Debounce window: 300ms. Uses `src/util/debounce.ts`.
- `clearView` is wired into the painting-delete code path (currently in `Sidebar.svelte` / `PaintingList.svelte`); if the wiring is missed, orphan entries are harmless (tiny, bounded by number of paintings ever opened).

### New: `src/ui/CanvasToolbar.svelte`

Props:
```ts
export let zoom: number;
export let minZoom: number;
export let maxZoom: number;
export let onZoomIn: () => void;
export let onZoomOut: () => void;
export let onSetZoom: (z: number) => void;
export let onFit: () => void;
export let onResetOneToOne: () => void;
```

`minZoom` and `maxZoom` are used only to disable `−` / `+` at the limits and to filter the preset menu.

Layout (left to right): `[ − ]  [  75% ▾ ]  [ + ]  │  [ ⛶ Fit ]  [ 1:1 ]`.

- `−` and `+` step zoom by 1.25× (toward `minZoom` / `maxZoom`). Disabled at the limits.
- `75% ▾` opens a small menu with preset values: 25, 50, 75, 100, 200, 400, 800 (filtered to those inside `[minZoom, maxZoom]`). Clicking a value calls `onSetZoom`.
- `⛶ Fit` calls `onFit`.
- `1:1` calls `onResetOneToOne` (zoom = 1, pan centers the canvas; if 1 is below `minZoom`, falls back to `minZoom`).
- Tooltips list keyboard shortcuts: `+ / -`, `0` (Fit), `1` (1:1).
- Responsive: at `host` width < 480px, hide the "Fit" / "1:1" labels, keep icons only.

Styling: container `position: absolute; right: var(--space-5); bottom: var(--space-5);`, `background: #fff`, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow)`, `padding: var(--space-2)`. Icon buttons ~32px square. Vertical separator `1px solid var(--border)` between the zoom block and the actions block.

### Modified: `src/editor/PaintingEditor.svelte`

1. Add reactive state:
   ```ts
   const basePps = 12;
   let zoom = 1;
   let panX = 0;
   let panY = 0;
   $: pps = basePps * zoom;
   ```
2. Replace the hardcoded `pps = 12` references with the derived `pps`. The existing `refresh()` already uses `pps` everywhere, so this is a no-op rename.
3. Replace `centerAndConfigurePan` with a `applyView()` that calls `stage.position({ x: panX, y: panY })` and sets `stage.draggable(true)` unconditionally.
4. `onMount`:
   - Load `loadView(id)`. If null → call `fitView(...)` and apply.
   - If present → clamp the loaded view against current `computeZoomBounds` and `clampPan` before applying.
   - Wire `stage.on('wheel', onWheel)`, `stage.on('dragend', onStageDragEnd)`.
   - `window.addEventListener('keydown', onKeyDown)` and `window.addEventListener('resize', onResize)`.
   - `new ResizeObserver(onResize).observe(host)` for host resizes that don't trigger window resize.
5. `onDestroy`: tear down listeners, observer, `flushPendingSaves()`.
6. `onWheel`:
   - `e.evt.preventDefault()`.
   - If `ctrlKey || metaKey`: zoom. `factor = e.evt.deltaY < 0 ? 1.1 : 1/1.1`. Pivot = `{ x: e.evt.offsetX, y: e.evt.offsetY }`. Call `zoomAtPoint`.
   - Else if `shiftKey`: pan horizontally by `deltaY` (mouse without horizontal wheel).
   - Else: pan by `(-deltaX, -deltaY)`.
   - Apply `clampPan`, then `saveView` debounced.
7. `onKeyDown`:
   - Ignore if target is INPUT / TEXTAREA / contentEditable (same filter as `App.svelte`).
   - `+` or `=` → zoom in by 1.25× at viewport center.
   - `-` or `_` → zoom out by 1.25× at viewport center.
   - `0` → fit.
   - `1` → 1:1 (with fallback to `minZoom`).
8. `onStageDragEnd`: read `stage.position()`, update `panX/panY`, clamp, persist.
9. `onResize`: update `stage.size(...)`, recompute bounds, clamp zoom and pan, persist.
10. Render the toolbar **inside** `.canvas-wrap` so it floats above the canvas:
    ```svelte
    <div class="canvas-wrap">
      <div class="canvas-host" bind:this={host}></div>
      <CanvasToolbar {zoom} canFit={...} {onZoomIn} {onZoomOut} {onSetZoom} {onFit} {onResetOneToOne} />
    </div>
    ```
    `.canvas-wrap` gets `position: relative` so the absolute toolbar anchors correctly.

### Modified: `src/ui/Sidebar.svelte`

In the `remove(id)` function (around line 43): after `project.update(...)`, call `clearView(id)` from `viewState.ts`. Single line addition.

## Interaction model

| Input | Action | Pivot |
|---|---|---|
| Ctrl/Cmd + wheel | Zoom | Cursor |
| Pinch on trackpad (emits `wheel + ctrlKey`) | Zoom | Cursor |
| Wheel (no modifier) | Pan (deltaX, deltaY) | — |
| Shift + wheel | Pan horizontal (deltaY → deltaX) | — |
| Drag stage background | Pan | — |
| `+` / `=` | Zoom in 1.25× | Viewport center |
| `-` / `_` | Zoom out 1.25× | Viewport center |
| `0` | Fit | — |
| `1` | 1:1 (or `minZoom` if 1 < `minZoom`) | Viewport center |
| Toolbar `−` / `+` | Zoom 1.25× | Viewport center |
| Toolbar `Fit` | Fit | — |
| Toolbar `1:1` | 1:1 fallback `minZoom` | Viewport center |
| Toolbar preset menu | Set zoom to exact value | Viewport center |

Wheel `preventDefault` is always called when the canvas has focus / hover, so the page never scrolls because of canvas interaction.

## Stage drag vs image drag

Today `imageNode` has `draggable: true`. The plan adds `stage.draggable(true)` unconditionally. Konva resolves drag targets bottom-up: clicks landing on `imageNode` or its transformer drag the image; clicks on the background `bgLayer` (checkerboard) or empty area drag the stage.

**Fallback** if this causes friction in manual testing: gate stage drag behind holding `Space` (Figma / Photoshop pattern). The decision is recorded during implementation, not now — the simpler default is tried first.

## Zoom bounds

- `minZoom = min(fitZoom, 1)` where `fitZoom` makes the whole canvas fit with a 32px margin on each side. Capping at 1 means small canvases (e.g. 1×1 block = 16×16 source units = 192×192 host px at zoom 1) can't be zoomed out below 100% — there's no value in seeing them smaller.
- `maxZoom = 8`. At zoom 8 with `basePps = 12`, one source unit = 96 host pixels. Comfortable for fine inspection.
- Margin = 32px so the fit view has visible breathing room around the canvas instead of touching the edges.

## Pan bounds

`clampPan` keeps at least 64px of the canvas inside the viewport on each axis. At high zoom, large portions of the canvas can go off-screen — that's intentional — but the user cannot lose the canvas entirely off the viewport.

## Persistence

- `viewState.ts` reads / writes `mc-pm-views` in localStorage.
- Saved fields: `zoom`, `panX`, `panY` per painting id.
- View is **not** part of `Painting`, **not** in the project JSON, **not** in undo / redo.
- Debounced write at 300ms; final flush on editor destroy.
- On editor mount: load view; if absent, fit. If present, clamp to current bounds before applying (window may have been resized since last session, or canvas dimensions changed).
- On painting delete: `clearView(id)`.

## Edge cases

- **Window or host resized:** ResizeObserver updates `stage.size`, recomputes bounds, clamps zoom and pan. No automatic re-fit — the user retains control.
- **Canvas dimensions changed** (user edits `canvasW16/H16`): triggers the existing reactive `refresh()`. `applyView()` re-clamps and re-applies. Persists.
- **Loaded view is now out-of-bounds** (e.g. larger canvas now): clamped on load.
- **Tiny canvas + huge viewport:** `minZoom` capped at 1, so the canvas can't shrink to a dot; pan still works.
- **Trackpad without `ctrlKey` simulation:** browsers reliably emit `ctrlKey: true` for pinch in Chrome / Firefox / Safari on macOS and Windows. No special-casing needed.
- **Keyboard layout `+`:** captured via `e.key === '+' || e.key === '='`. `-` via `e.key === '-' || e.key === '_'`. Covers US, IT, DE common layouts.
- **Painting deleted while open:** the existing `$: if (selectedId && !found) selectedId = null` in `App.svelte` unmounts the editor; `flushPendingSaves` runs in `onDestroy`.

## Test strategy

### Unit tests

- `src/editor/zoomMath.test.ts`:
  - `computeZoomBounds`: small canvas + large host → minZoom = 1; large canvas + small host → minZoom < 1 and equal to fitZoom; aspect ratio mismatch picks the limiting axis; maxZoom always 8.
  - `fitView`: returned zoom equals `fitZoom`; pan centers the canvas (`panX = (hostW - canvasW*pps)/2`).
  - `zoomAtPoint`: world point under pivot stays under pivot after zoom (within 1px); factor clamped at bounds; pivot at center reduces to "scale and re-center".
  - `clampPan`: pan well inside → unchanged; pan that hides the whole canvas → clamped so 64px remain visible on the violated axis.
- `src/stores/viewState.test.ts`:
  - `saveView` then `loadView` round-trips exactly.
  - `loadView` of an unknown id returns null.
  - Corrupt JSON in storage → `loadView` returns null, no throw; subsequent `saveView` writes a fresh blob.
  - `clearView(id)` removes only that id.

### Component / manual

`PaintingEditor.svelte` has no component tests today; jsdom + Konva is fragile. Verified manually with this checklist:

- [ ] Ctrl + wheel zooms; the point under cursor stays under cursor.
- [ ] Wheel without modifier pans (deltaX horizontal, deltaY vertical).
- [ ] Shift + wheel pans horizontally.
- [ ] Pinch on trackpad zooms.
- [ ] Toolbar `+` / `−` / Fit / 1:1 / preset menu behave as labeled.
- [ ] `+`, `-`, `0`, `1` keys behave the same as toolbar equivalents; ignored when typing in an input field.
- [ ] Image drag and transformer continue to work; stage drag fires only when starting on the background.
- [ ] Snap-to-block remains exact at all zoom levels (the committed `x16, y16, w16, h16` are integers).
- [ ] Refreshing the page restores zoom and pan for the open painting.
- [ ] Switching between paintings shows each one's saved view (or fits if never opened).
- [ ] Resizing the browser window doesn't lose the canvas; if zoom drops below the new `minZoom` it clamps gracefully.
- [ ] Deleting a painting clears its view entry (verifiable in DevTools localStorage).

## Risks and mitigations

- **Stage drag conflicts with image drag.** Mitigation: fallback to `Space`-hold pan if conflicts surface during manual testing.
- **Wheel `preventDefault` swallowing intentional page scroll.** The canvas occupies a bounded region; `preventDefault` is only called on `stage.on('wheel')`, which fires for events on the stage container. Outside the canvas the page scrolls normally.
- **localStorage quota.** Each view is ~80 bytes JSON. 10k paintings = ~800KB, well under quota. Not a practical concern.
- **Performance of full rebuild on each zoom step.** `refresh()` rebuilds checkerboard, grid, image node, raster preview, overlay. For typical canvas sizes (1×1 to 4×4 blocks = up to 64×64 cells) this is cheap. Wheel events are coalesced by the browser; for very fast wheels a small `requestAnimationFrame` batch can be added if jank surfaces. Not pre-emptively built.

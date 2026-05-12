# Preview With Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the painting editor preview reflect texture density and scaling settings, and dim with a 60% white overlay any image area lying outside the canvas.

**Architecture:** A new helper `previewRaster.ts` wraps the existing `rasterize()` to produce a token-tagged `HTMLImageElement`. `PaintingEditor.svelte` gains a rasterized layer (shown when idle), a white-overlay layer for out-of-bounds image regions, and a live/settled mode state machine. During drag/transform the source image renders directly with `imageSmoothingEnabled` matching `resampling`; on commit, the rasterized result replaces the in-bounds view.

**Tech Stack:** Svelte 5, Konva 9, Vitest with happy-dom, TypeScript.

**Spec reference:** `docs/superpowers/specs/2026-05-12-preview-with-settings-design.md`

---

## File Structure

- **Create** `src/editor/previewRaster.ts` — single-function module: `rasterizeForPreview(p, token, decode?)`. Wraps `rasterize()`, decodes bytes to `HTMLImageElement`, returns `{ token, image }` or `null` on error. The optional `decode` parameter exists to make the function unit-testable in happy-dom (production uses the default Blob-URL decoder).
- **Create** `src/editor/previewRaster.test.ts` — three tests: token passthrough, painting passthrough, null on error. Uses `vi.mock` to stub `rasterize`.
- **Modify** `src/editor/PaintingEditor.svelte` — add raster + overlay layers, mode state machine, drag/transform start/end hooks, reactive raster trigger, overlay geometry updater.

---

## Task 1: previewRaster module

**Files:**
- Create: `src/editor/previewRaster.ts`
- Test: `src/editor/previewRaster.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/editor/previewRaster.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Painting } from '../paintings/types';

vi.mock('../paintings/rasterize', () => ({
  rasterize: vi.fn(),
}));

import { rasterize } from '../paintings/rasterize';
import { rasterizeForPreview } from './previewRaster';

const mockRasterize = vi.mocked(rasterize);

function painting(): Painting {
  return {
    id: 'p', name: 'p', slug: 'p', slugVersion: 1,
    canvasW16: 16, canvasH16: 16,
    source: { pngBase64: '', naturalW: 64, naturalH: 64 },
    transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
    resampling: 'smooth', textureDensity: 'auto', material: 'alphatest',
  };
}

describe('rasterizeForPreview', () => {
  beforeEach(() => mockRasterize.mockReset());

  it('returns the token unchanged when rasterize resolves', async () => {
    mockRasterize.mockResolvedValueOnce(new Uint8Array([137, 80, 78, 71]));
    const fakeImage = {} as HTMLImageElement;
    const decode = vi.fn().mockResolvedValue(fakeImage);
    const r = await rasterizeForPreview(painting(), 42, decode);
    expect(r).not.toBeNull();
    expect(r!.token).toBe(42);
    expect(r!.image).toBe(fakeImage);
  });

  it('passes the painting to rasterize exactly once', async () => {
    mockRasterize.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    const decode = vi.fn().mockResolvedValue({} as HTMLImageElement);
    const p = painting();
    await rasterizeForPreview(p, 1, decode);
    expect(mockRasterize).toHaveBeenCalledWith(p);
    expect(mockRasterize).toHaveBeenCalledTimes(1);
  });

  it('returns null when rasterize rejects', async () => {
    mockRasterize.mockRejectedValueOnce(new Error('canvas broken'));
    const decode = vi.fn().mockResolvedValue({} as HTMLImageElement);
    const r = await rasterizeForPreview(painting(), 7, decode);
    expect(r).toBeNull();
  });

  it('returns null when decode rejects', async () => {
    mockRasterize.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    const decode = vi.fn().mockRejectedValue(new Error('decode failed'));
    const r = await rasterizeForPreview(painting(), 3, decode);
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm test -- src/editor/previewRaster.test.ts`
Expected: FAIL with "Failed to load url ./previewRaster" or "rasterizeForPreview is not a function".

- [ ] **Step 3: Create the module**

Create `src/editor/previewRaster.ts`:

```typescript
import type { Painting } from '../paintings/types';
import { rasterize } from '../paintings/rasterize';

export type PreviewRasterResult = { token: number; image: HTMLImageElement };

export type DecodeFn = (bytes: Uint8Array) => Promise<HTMLImageElement>;

const defaultDecode: DecodeFn = (bytes) =>
  new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image decode failed')); };
    img.src = url;
  });

export async function rasterizeForPreview(
  p: Painting,
  token: number,
  decode: DecodeFn = defaultDecode,
): Promise<PreviewRasterResult | null> {
  try {
    const bytes = await rasterize(p);
    const image = await decode(bytes);
    return { token, image };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm test -- src/editor/previewRaster.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/editor/previewRaster.ts src/editor/previewRaster.test.ts
git commit -m "feat(editor): add previewRaster helper for token-tagged rasterized preview"
```

---

## Task 2: Source image respects resampling setting

**Files:**
- Modify: `src/editor/PaintingEditor.svelte:71-110` (the `drawImage` function)

This is the live-mode visual: when the user is dragging or transforming, the source image should preview its scaling behavior (smooth vs pixelated). We set the `imageSmoothingEnabled` shape attribute on the Konva.Image.

- [ ] **Step 1: Modify `drawImage` to set `imageSmoothingEnabled` from `painting.resampling`**

In `src/editor/PaintingEditor.svelte`, inside `drawImage()` right after constructing `imageNode`, add a setter. Replace lines 76-83 (the `imageNode = new Konva.Image({...})` block) with:

```typescript
    imageNode = new Konva.Image({
      image: img,
      x: painting.transform.x16 * pps,
      y: painting.transform.y16 * pps,
      width: painting.transform.w16 * pps,
      height: painting.transform.h16 * pps,
      draggable: true,
      imageSmoothingEnabled: painting.resampling === 'smooth',
    });
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No errors. (Konva.Image accepts `imageSmoothingEnabled` as a shape attribute in Konva 9.x.)

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All existing tests still pass.

- [ ] **Step 4: Manual verification**

Start dev server: `npm run dev`. Import an image into a fresh painting. In the property panel, toggle "Scaling" between "Smooth" and "Pixel art". Observe: with the image scaled larger than its native size, smooth should look interpolated/blurry at edges; pixel art should show crisp blocky pixels.

- [ ] **Step 5: Commit**

```bash
git add src/editor/PaintingEditor.svelte
git commit -m "feat(editor): source image preview honors resampling setting"
```

---

## Task 3: Rasterized layer with mode and token

**Files:**
- Modify: `src/editor/PaintingEditor.svelte` (multiple regions)

Add a rasterized-preview layer between `imageLayer` and `gridLayer`. The rasterized image is shown in settled mode, hidden in live mode. A monotonic token guards against stale rasterize results overwriting newer ones.

- [ ] **Step 1: Import the rasterize helper and the Painting type**

In `src/editor/PaintingEditor.svelte`, after the existing `import { project }` line (line 4), add:

```typescript
  import { rasterizeForPreview } from './previewRaster';
  import type { Painting } from '../paintings/types';
```

- [ ] **Step 2: Add state variables and signature helper**

At the top of the `<script lang="ts">` block (after the existing `let imageNode` declaration on line 13), add:

```typescript
  let rasterLayer: Konva.Layer;
  let rasterImageNode: Konva.Image | null = null;
  let cachedRasterImg: HTMLImageElement | null = null;
  let rasterToken = 0;
  let rasterSig = '';
  let mode: 'live' | 'settled' = 'settled';

  function currentRasterSig(p: Painting): string {
    const t = p.transform;
    const s = p.source;
    return [
      p.canvasW16, p.canvasH16, p.textureDensity, p.resampling,
      t.x16, t.y16, t.w16, t.h16, t.rotation, t.flipX, t.flipY,
      s ? s.pngBase64.length : 0, s ? s.naturalW : 0, s ? s.naturalH : 0,
    ].join(':');
  }
```

- [ ] **Step 3: Add `rasterLayer` to the stage**

Replace line 24 (`stage.add(bgLayer, imageLayer, gridLayer);`) with:

```typescript
    rasterLayer = new Konva.Layer();
    stage.add(bgLayer, imageLayer, rasterLayer, gridLayer);
```

- [ ] **Step 4: Add the rasterize trigger function**

Below the `commitTransform` function (after line 146), before the final `$:` reactive block, add:

```typescript
  async function maybeStartRaster() {
    if (!painting) return;
    if (mode === 'live') return;
    const sig = currentRasterSig(painting);
    if (sig === rasterSig && cachedRasterImg) return;
    rasterSig = sig;
    rasterToken++;
    const myToken = rasterToken;
    const result = await rasterizeForPreview(painting, myToken);
    if (!result || result.token !== rasterToken) return;
    cachedRasterImg = result.image;
    if (rasterImageNode) {
      rasterImageNode.image(cachedRasterImg);
      rasterLayer.batchDraw();
    }
  }
```

- [ ] **Step 5: Rebuild the raster image node inside `refresh`**

Replace the `refresh()` function (lines 30-41) with:

```typescript
  async function refresh() {
    if (!stage || !painting) return;
    stage.size({ width: host.clientWidth, height: host.clientHeight });
    bgLayer.destroyChildren();
    imageLayer.destroyChildren();
    rasterLayer.destroyChildren();
    gridLayer.destroyChildren();
    rasterImageNode = null;
    drawCheckerboard();
    await drawImage();
    drawRasterPreview();
    drawGrid();
    centerAndConfigurePan();
    bgLayer.draw(); imageLayer.draw(); rasterLayer.draw(); gridLayer.draw();
    maybeStartRaster();
  }
```

- [ ] **Step 6: Add `drawRasterPreview`**

After the `drawImage` function (after line 110), add:

```typescript
  function drawRasterPreview() {
    if (!painting || !cachedRasterImg) return;
    rasterImageNode = new Konva.Image({
      image: cachedRasterImg,
      x: 0,
      y: 0,
      width: painting.canvasW16 * pps,
      height: painting.canvasH16 * pps,
      imageSmoothingEnabled: false,
      listening: false,
      visible: mode === 'settled',
    });
    rasterLayer.add(rasterImageNode);
  }
```

- [ ] **Step 7: Hook drag/transform start/end on the image node**

Inside `drawImage()`, replace the existing `imageNode.on(...)` and `tr.on(...)` blocks (lines 84-108) with:

```typescript
    imageNode.on('dragstart', () => {
      mode = 'live';
      rasterToken++;
      if (rasterImageNode) { rasterImageNode.hide(); rasterLayer.batchDraw(); }
    });
    imageNode.on('dragmove', () => {
      if (!imageNode) return;
      const sx = Math.round(imageNode.x() / pps) * pps;
      const sy = Math.round(imageNode.y() / pps) * pps;
      imageNode.position({ x: sx, y: sy });
    });
    imageNode.on('dragend', () => {
      mode = 'settled';
      if (rasterImageNode) { rasterImageNode.show(); rasterLayer.batchDraw(); }
      commitTransform();
    });
    imageLayer.add(imageNode);

    const tr = new Konva.Transformer({
      nodes: [imageNode],
      rotateEnabled: false,
      keepRatio: false,
      anchorSize: 10,
      enabledAnchors: ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center'],
    });
    tr.on('transformstart', () => {
      mode = 'live';
      rasterToken++;
      if (rasterImageNode) { rasterImageNode.hide(); rasterLayer.batchDraw(); }
    });
    tr.on('transformend', () => {
      if (!imageNode) return;
      const w = imageNode.width() * imageNode.scaleX();
      const h = imageNode.height() * imageNode.scaleY();
      imageNode.scale({ x: 1, y: 1 });
      imageNode.width(w);
      imageNode.height(h);
      mode = 'settled';
      if (rasterImageNode) { rasterImageNode.show(); rasterLayer.batchDraw(); }
      commitTransform();
    });
    imageLayer.add(tr);
```

- [ ] **Step 8: Run typecheck**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 9: Run all tests**

Run: `npm test`
Expected: All tests still pass.

- [ ] **Step 10: Manual verification**

Start dev server: `npm run dev`. Import an image and confirm:
1. After import, after ~1 frame, the canvas region shows the rasterized output (sharp texture pixels at the chosen density).
2. Dragging the image: during drag the source image shows (smooth, no quantization). On release, the rasterized layer reappears.
3. Changing `Resolution` (density) in the property panel: the rasterized image updates to show the new pixel grid.
4. Changing `Scaling` (resampling): the rasterized image updates with smooth or pixelated rescaling baked in.
5. Resizing the image via transformer handles: rasterized layer hides during transform, reappears with new aspect on release.

- [ ] **Step 11: Commit**

```bash
git add src/editor/PaintingEditor.svelte
git commit -m "feat(editor): rasterized preview layer reflects density and resampling"
```

---

## Task 4: White overlay for out-of-canvas image area

**Files:**
- Modify: `src/editor/PaintingEditor.svelte` (add overlay layer + four strip rects)

Four `Konva.Rect` strips with `fill: 'white'`, `opacity: 0.6` cover the parts of the source image that sit outside the canvas rectangle. Strips with zero or negative dimension are skipped.

- [ ] **Step 1: Add overlay state**

In `src/editor/PaintingEditor.svelte`, after the `rasterImageNode` declaration added in Task 3, add:

```typescript
  let overlayLayer: Konva.Layer;
  let overlayRects: { top: Konva.Rect; bottom: Konva.Rect; left: Konva.Rect; right: Konva.Rect } | null = null;
```

- [ ] **Step 2: Add `overlayLayer` to the stage**

Replace the `stage.add(...)` line from Task 3 with:

```typescript
    rasterLayer = new Konva.Layer();
    overlayLayer = new Konva.Layer({ listening: false });
    stage.add(bgLayer, imageLayer, rasterLayer, overlayLayer, gridLayer);
```

- [ ] **Step 3: Add `drawOverlay` function**

After the `drawRasterPreview` function (added in Task 3), add:

```typescript
  function drawOverlay() {
    if (!painting) return;
    const top = new Konva.Rect({ fill: 'white', opacity: 0.6, listening: false });
    const bottom = new Konva.Rect({ fill: 'white', opacity: 0.6, listening: false });
    const left = new Konva.Rect({ fill: 'white', opacity: 0.6, listening: false });
    const right = new Konva.Rect({ fill: 'white', opacity: 0.6, listening: false });
    overlayLayer.add(top, bottom, left, right);
    overlayRects = { top, bottom, left, right };
    updateOverlayGeometry();
  }

  function updateOverlayGeometry() {
    if (!painting || !overlayRects || !imageNode) return;
    const imgX = imageNode.x();
    const imgY = imageNode.y();
    const imgW = imageNode.width();
    const imgH = imageNode.height();
    const cX = 0;
    const cY = 0;
    const cR = painting.canvasW16 * pps;
    const cB = painting.canvasH16 * pps;
    const imgR = imgX + imgW;
    const imgB = imgY + imgH;

    // Strips clipped to the image bounding box; zero-dim strips are invisible.
    const topH = Math.max(0, cY - imgY);
    overlayRects.top.position({ x: imgX, y: imgY });
    overlayRects.top.size({ width: imgW, height: topH });

    const bottomH = Math.max(0, imgB - cB);
    overlayRects.bottom.position({ x: imgX, y: cB });
    overlayRects.bottom.size({ width: imgW, height: bottomH });

    // Left/right strips occupy only the vertical band inside the canvas's Y range,
    // intersected with the image's Y range, so we don't double-cover the corners.
    const innerTop = Math.max(imgY, cY);
    const innerBottom = Math.min(imgB, cB);
    const innerH = Math.max(0, innerBottom - innerTop);

    const leftW = Math.max(0, cX - imgX);
    overlayRects.left.position({ x: imgX, y: innerTop });
    overlayRects.left.size({ width: leftW, height: innerH });

    const rightW = Math.max(0, imgR - cR);
    overlayRects.right.position({ x: cR, y: innerTop });
    overlayRects.right.size({ width: rightW, height: innerH });

    overlayLayer.batchDraw();
  }
```

- [ ] **Step 4: Call `drawOverlay` from `refresh`**

In `refresh()`, replace the body so it also clears and rebuilds the overlay. Replace the current refresh implementation (from Task 3) with:

```typescript
  async function refresh() {
    if (!stage || !painting) return;
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
    centerAndConfigurePan();
    bgLayer.draw(); imageLayer.draw(); rasterLayer.draw(); overlayLayer.draw(); gridLayer.draw();
    maybeStartRaster();
  }
```

- [ ] **Step 5: Update overlay on dragmove and transform**

The overlay must track the image in real time while dragging or transforming. In `drawImage()`:

(a) Replace the `dragmove` handler set in Task 3 (it snaps the image to the 1/16 grid) with this version that also refreshes overlay geometry:

```typescript
    imageNode.on('dragmove', () => {
      if (!imageNode) return;
      const sx = Math.round(imageNode.x() / pps) * pps;
      const sy = Math.round(imageNode.y() / pps) * pps;
      imageNode.position({ x: sx, y: sy });
      updateOverlayGeometry();
    });
```

(b) Add a continuous `transform` listener on the transformer, immediately after the `tr.on('transformstart', ...)` handler from Task 3 and before the `tr.on('transformend', ...)` handler:

```typescript
    tr.on('transform', () => {
      updateOverlayGeometry();
    });
```

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: All tests still pass.

- [ ] **Step 8: Manual verification**

Start dev server: `npm run dev`. Import a wide image into a small canvas, or shrink the canvas in the property panel so the image overflows. Confirm:
1. The portion of the image outside the canvas is visibly washed out (white tint, image still recognizable beneath).
2. The portion of the image inside the canvas keeps full color.
3. Drag the image around: the overlay follows in real time.
4. Resize via transformer: the overlay follows in real time.
5. Resize the canvas via the property panel to fully contain the image: the overlay disappears entirely.

- [ ] **Step 9: Commit**

```bash
git add src/editor/PaintingEditor.svelte
git commit -m "feat(editor): dim out-of-canvas image area with 60% white overlay"
```

---

## Done criteria

- `previewRaster.ts` exists with 4 passing unit tests.
- Editor preview rasterizes through the export pipeline when idle and matches the final `.mcaddon` texture.
- Editor preview during drag/transform renders the source image with `imageSmoothingEnabled` set from `resampling`.
- Image area outside the canvas is dimmed with a 60% white overlay; in-canvas area is full color.
- `npm test` and `npm run check` both clean.

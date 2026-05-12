# Preview With Settings Design

**Status:** Approved 2026-05-12
**Owner:** Fabrizio La Rosa

## Goal

The painting editor preview reflects the texture as it will appear in the exported `.mcaddon`, accounting for `textureDensity` and `resampling`. Any image area lying outside the canvas rectangle is de-emphasized with a 60%-opacity white overlay so the user reads it as "won't be exported."

## Motivation

Today the editor renders the raw source image with Konva's default smooth scaling. The user cannot see what the final texture will look like until export. Density quantization and pixelated vs smooth scaling are invisible during editing, so users iterate blind on the two settings that most affect output quality.

Additionally, when the canvas is smaller than the image (the user can pan/scale the image outside the canvas bounds), both regions render with equal visual weight, making it ambiguous which pixels actually become part of the painting.

## Non-goals

- No change to the export pipeline or `rasterize.ts`. The preview consumes existing output; it does not modify it.
- No change to property panel UI. Settings still live in `PaintingProperties.svelte`.
- No new persisted state. The preview is purely derived.
- No rendering-performance optimization beyond what the hybrid strategy already buys.

## Architecture

The editor stage gains one new visual layer and one new transient image node, on top of the existing layout:

```
bg (checkerboard)
  source image (existing, modified to use imageSmoothingEnabled hint)
  rasterized texture (new, shown when idle, clipped to canvas rect)
  white overlay (new, 60% opacity, masking everything outside the canvas rect)
grid (existing, stays on top)
```

The source image stays in the scene so the user can still see what extends beyond the canvas; the rasterized layer overlays the in-bounds portion to show the final pixels.

## Hybrid update strategy

Two display modes share the same scene:

**Live mode** (during `dragmove` / `transform` events):
- Rasterized layer hidden.
- Source image visible, drawn with `imageSmoothingEnabled` matching the painting's `resampling` setting (`false` for pixelated, `true` for smooth).
- White overlay visible and updated to follow the image's transformed bounds.

**Settled mode** (after `dragend` / `transformend`, or on property change to `canvasW16`, `canvasH16`, `textureDensity`, `resampling`, `transform`, or `source`):
- Rasterize is invoked. While in flight, the previously-rendered rasterized layer remains visible.
- On resolve, the new texture replaces the previous rasterized layer.
- Source image stays visible underneath; only the inside-canvas region is covered by the rasterized layer.

Mode transitions:
- `dragstart` / `transformstart` → enter live mode.
- `dragend` / `transformend` → enter settled mode, kick off rasterize.
- Property change (any of the listed fields) → kick off rasterize (already in settled mode).

## Stale-result guard

Rasterize is async. Each call captures a monotonically-increasing token. On resolve, the callback compares its token to the latest issued token; mismatch means the result is discarded and the existing rasterized image stays on screen until a newer call completes. This prevents an in-flight rasterize for stale state from overwriting a more recent one.

The token is also bumped on `dragstart` / `transformstart`, even though no new rasterize is issued. This invalidates any in-flight rasterize from before the drag began, so its result cannot land on screen when the user releases the drag with the now-stale pre-drag pixels.

## White overlay geometry

The overlay covers everything outside the canvas rect (which is at stage coordinates `(0, 0)` to `(canvasW16 * pps, canvasH16 * pps)`). Implementation uses four `Konva.Rect` strips clipped to the source image's transformed bounding box:

- Top strip: from image-top to canvas-top, across the image's horizontal extent.
- Bottom strip: from canvas-bottom to image-bottom, across the image's horizontal extent.
- Left strip: from image-left to canvas-left, between canvas-top and canvas-bottom.
- Right strip: from canvas-right to image-right, between canvas-top and canvas-bottom.

Each rect is `fill: 'white'`, `opacity: 0.6`, `listening: false`. Strips with zero or negative width/height are skipped (image fully inside the canvas on that axis).

We intentionally do not paint over empty stage area; the overlay only dims actual image content.

## Rasterized layer rendering

The rasterized PNG has pixel dimensions `canvasW16 * density × canvasH16 * density`. It is displayed in the stage at `canvasW16 * pps × canvasH16 * pps` (the canvas extent at editor zoom). The screen-side upscale uses nearest-neighbor (`imageSmoothingEnabled = false`) so each texture pixel renders as a sharp `pps/density × pps/density` screen square. The `resampling` choice already affected the rasterize step; the display step always preserves texture pixels as-is.

### Transparency caveat

The source image is still drawn underneath the rasterized layer in settled mode (so it can extend past the canvas into the dimmed region). If the rasterized texture has fully transparent pixels (e.g. `alphatest` cutout or `alphablend`), the source image shows through at those pixels. We accept this as a reasonable approximation: in-game the same pixels are transparent and let scene contents show through. We do not implement inverse-clip on the source layer for this release; the workaround is cheap if a user complains later.

## File structure

- **Modify** `src/editor/PaintingEditor.svelte`:
  - Add a `Konva.Image` node for the rasterized texture, parented to a new layer between `imageLayer` and `gridLayer`.
  - Add four `Konva.Rect` overlay nodes, parented to a dedicated overlay layer between rasterized and grid.
  - Track live/settled mode in a component variable.
  - Apply `imageSmoothingEnabled` to the source image node based on `resampling`.
  - Hook `dragstart` / `transformstart` to enter live mode (hide rasterized layer).
  - Hook `dragend` / `transformend` to enter settled mode (kick off rasterize).
  - Recompute overlay strip geometry whenever the source image's transformed bounds or the canvas size change.

- **Create** `src/editor/previewRaster.ts`:
  - Exports `rasterizeToImage(p: Painting, token: number): Promise<{ token: number; image: HTMLImageElement } | null>`.
  - Wraps the existing `rasterize(p)` from `src/paintings/rasterize.ts`, decodes the PNG bytes into an `HTMLImageElement` (data URL), and returns it along with the token.
  - On any internal error returns `null` so the caller leaves the previous preview in place.

- **Create** `src/editor/previewRaster.test.ts`:
  - Test that the returned image has pixel dimensions `canvasW16 * density × canvasH16 * density` for a representative painting with a real `Source`.
  - Test that the returned token equals the input token.
  - Test that a painting without a source still produces an image (a transparent canvas-sized PNG via `rasterize`, which already handles that case).

## Edge cases

- **Image fully inside canvas**: all four overlay strips have zero or negative dimensions and are skipped. No visible overlay. Correct.
- **Painting without source**: source image node is not drawn, no overlay needed, rasterize still runs (produces transparent PNG), rasterized layer shows nothing meaningful but no error.
- **Canvas resize mid-rasterize**: token mismatch on resolve, result discarded. The reactive `$:` block triggers a fresh rasterize for the new canvas size.
- **User drags while a rasterize is in flight**: `dragstart` bumps the token, so the in-flight rasterize will be discarded on resolve. Live mode hides the rasterized layer. `dragend` issues a fresh rasterize with the latest token.
- **Property change during live mode** (e.g., density slider tweaked mid-drag): defer the rasterize. The reactive trigger checks the current mode and skips rasterization while in live mode. `dragend` will pick up the new properties when it issues its own rasterize.
- **Density change with no transform change**: triggers a rasterize via the reactive property-change path. Source image unchanged.
- **Resampling change**: same as density change.
- **Initial mount**: enter settled mode by default, kick off the first rasterize once the source image has loaded.

## Test strategy

Unit tests cover `previewRaster.ts` (pixel dimensions, token passthrough, no-source case). The Konva-based rendering in `PaintingEditor.svelte` is not unit-tested today and we do not add component tests for the overlay geometry, since Konva nodes render to canvas and are awkward to assert against. Manual verification will confirm:

1. Drag the image so it extends past the canvas edge: the outside portion turns visibly faded; the inside stays full color.
2. Toggle resampling between smooth and pixel art with the image fitting inside the canvas at less than 1:1 density: smooth shows interpolated edges; pixel art shows blocky edges.
3. Change density from 1 to 64: visible texture-pixel size grows or shrinks accordingly.
4. Drag rapidly: live mode preview tracks smoothly (no rasterize stutter).
5. Release drag: rasterized layer reappears within a frame or two.

## Open questions

None.

// Renders a procedural wooden-frame back texture once per pack. The same texture is
// referenced by every painting in the resource pack via a shared render controller.
//
// Layout (when looking straight at the 64×64 texture):
//   ┌────────────────────────────────────┐
//   │  dark beveled outer frame edge      │  ← sampled by side faces (east/west/up/down)
//   │ ┌──────────────────────────────┐  │
//   │ │  inner lighter wood back panel │  │  ← sampled by south face
//   │ │  with thin plank seams         │  │
//   │ │                                │  │
//   │ └──────────────────────────────┘  │
//   │                                    │
//   └────────────────────────────────────┘
//
// The side faces (east/west/up/down) of the back cube sample only the OUTER edge slice
// of this texture, so they end up showing the dark frame edge — making the painting
// look like a properly framed picture from oblique angles.

const BACK_W = 64;
const BACK_H = 64;
const FRAME_THICKNESS = 8;

const COLOR_FRAME_OUTER = '#2b1f12';   // very dark wood: outermost bevel
const COLOR_FRAME = '#4a3520';         // dark wood: main frame body
const COLOR_FRAME_HIGHLIGHT = '#7a5a36'; // lighter bevel at the inner edge of the frame
const COLOR_BACK_PANEL = '#6e4f30';    // medium wood: back panel
const COLOR_PLANK_SEAM = '#3d2c1a';    // darker wood: plank lines on the back panel

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function paint(ctx: Ctx2D, w: number, h: number): void {
  // Outermost bevel — 1px dark line around the very edge
  ctx.fillStyle = COLOR_FRAME_OUTER;
  ctx.fillRect(0, 0, w, h);

  // Main frame body
  ctx.fillStyle = COLOR_FRAME;
  ctx.fillRect(1, 1, w - 2, h - 2);

  // Inner bevel highlight — 1px lighter line where the frame meets the back panel
  const innerX = FRAME_THICKNESS - 1;
  const innerY = FRAME_THICKNESS - 1;
  const innerW = w - 2 * innerX;
  const innerH = h - 2 * innerY;
  ctx.fillStyle = COLOR_FRAME_HIGHLIGHT;
  ctx.fillRect(innerX, innerY, innerW, innerH);

  // Back panel (interior) — fills inside the bevel highlight
  ctx.fillStyle = COLOR_BACK_PANEL;
  ctx.fillRect(FRAME_THICKNESS, FRAME_THICKNESS, w - 2 * FRAME_THICKNESS, h - 2 * FRAME_THICKNESS);

  // Plank seams on the back panel
  ctx.fillStyle = COLOR_PLANK_SEAM;
  const panelTop = FRAME_THICKNESS;
  const panelHeight = h - 2 * FRAME_THICKNESS;
  const panelLeft = FRAME_THICKNESS;
  const panelWidth = w - 2 * FRAME_THICKNESS;
  const planks = 3;
  for (let i = 1; i < planks; i++) {
    const y = panelTop + Math.round((panelHeight * i) / planks);
    ctx.fillRect(panelLeft, y, panelWidth, 1);
  }
}

export async function buildBackTexturePng(): Promise<Uint8Array> {
  const useOffscreen = typeof OffscreenCanvas !== 'undefined';
  const cvs: OffscreenCanvas | HTMLCanvasElement = useOffscreen
    ? new OffscreenCanvas(BACK_W, BACK_H)
    : Object.assign(document.createElement('canvas'), { width: BACK_W, height: BACK_H });
  const ctx = (cvs as HTMLCanvasElement).getContext('2d') as Ctx2D | null;
  if (!ctx) throw new Error('2d context unavailable');
  paint(ctx, BACK_W, BACK_H);
  const blob = useOffscreen
    ? await (cvs as OffscreenCanvas).convertToBlob({ type: 'image/png' })
    : await new Promise<Blob>((resolve, reject) => {
        (cvs as HTMLCanvasElement).toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      });
  return new Uint8Array(await blob.arrayBuffer());
}

// Constants exported so other modules (build, geometry, render controller) reference
// the same names. The name is namespaced to avoid collisions with user textures.
export const BACK_TEXTURE_FILENAME = 'painting_back';
export const BACK_RENDER_CONTROLLER_NAME = 'controller.render.painting_back';

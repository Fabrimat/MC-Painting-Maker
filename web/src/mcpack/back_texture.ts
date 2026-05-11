// Renders a procedural "wood plank" back texture once per pack. The same texture is
// referenced by every painting in the resource pack via a shared render controller.

const BACK_W = 64;
const BACK_H = 64;

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function paint(ctx: Ctx2D, w: number, h: number): void {
  ctx.fillStyle = '#6e4f30';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3d2c1a';
  // Horizontal plank seams every 1/4 of the texture height
  const rows = 4;
  for (let i = 1; i < rows; i++) {
    const y = Math.round((h * i) / rows);
    ctx.fillRect(0, y, w, 1);
  }
  // Thin frame border
  ctx.fillRect(0, 0, w, 1);
  ctx.fillRect(0, h - 1, w, 1);
  ctx.fillRect(0, 0, 1, h);
  ctx.fillRect(w - 1, 0, 1, h);
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

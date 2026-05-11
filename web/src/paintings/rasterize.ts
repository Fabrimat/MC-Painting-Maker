import { resolveDensity } from './density';
import type { Painting } from './types';

export type RasterParams = {
  density: number;
  canvasPx: { w: number; h: number };
  imageDstPx: { x: number; y: number; w: number; h: number };
};

export function computeRasterParams(p: Painting): RasterParams {
  const density = resolveDensity(p);
  const canvasPx = { w: p.canvasW16 * density, h: p.canvasH16 * density };
  const imageDstPx = {
    x: p.transform.x16 * density,
    y: p.transform.y16 * density,
    w: p.transform.w16 * density,
    h: p.transform.h16 * density,
  };
  return { density, canvasPx, imageDstPx };
}

export async function rasterize(p: Painting): Promise<Uint8Array> {
  const { canvasPx, imageDstPx } = computeRasterParams(p);
  const W = Math.max(1, canvasPx.w);
  const H = Math.max(1, canvasPx.h);

  const useOffscreen = typeof OffscreenCanvas !== 'undefined';
  const cvs: OffscreenCanvas | HTMLCanvasElement = useOffscreen
    ? new OffscreenCanvas(W, H)
    : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = (cvs as HTMLCanvasElement).getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  if (p.source && p.source.pngBase64) {
    const cleanB64 = p.source.pngBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const bytes = atob(cleanB64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([arr], { type: 'image/png' }));
    ctx.save();
    ctx.imageSmoothingEnabled = p.resampling === 'smooth';
    ctx.imageSmoothingQuality = 'high';
    const cx = imageDstPx.x + imageDstPx.w / 2;
    const cy = imageDstPx.y + imageDstPx.h / 2;
    ctx.translate(cx, cy);
    if (p.transform.rotation) ctx.rotate((p.transform.rotation * Math.PI) / 180);
    ctx.scale(p.transform.flipX ? -1 : 1, p.transform.flipY ? -1 : 1);
    ctx.drawImage(bmp, -imageDstPx.w / 2, -imageDstPx.h / 2, imageDstPx.w, imageDstPx.h);
    ctx.restore();
  }

  const blob = useOffscreen
    ? await (cvs as OffscreenCanvas).convertToBlob({ type: 'image/png' })
    : await new Promise<Blob>((resolve, reject) => {
        (cvs as HTMLCanvasElement).toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      });
  return new Uint8Array(await blob.arrayBuffer());
}

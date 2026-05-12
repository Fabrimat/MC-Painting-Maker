import type { Painting } from '../paintings/types';
import { rasterize } from '../paintings/rasterize';

export type PreviewRasterResult = { token: number; image: HTMLImageElement };

export type DecodeFn = (bytes: Uint8Array) => Promise<HTMLImageElement>;

const defaultDecode: DecodeFn = (bytes) =>
  new Promise((resolve, reject) => {
    const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
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

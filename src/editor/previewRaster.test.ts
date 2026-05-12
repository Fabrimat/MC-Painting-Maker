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
    id: 'p', name: 'p', slug: 'p', slugVersion: 1, slugLocked: false,
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

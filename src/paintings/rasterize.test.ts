import { describe, it, expect } from 'vitest';
import { createPaintingFromImage } from './defaults';
import { computeRasterParams } from './rasterize';

describe('computeRasterParams', () => {
  it('returns canvas size = canvasW16*density × canvasH16*density', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 100, naturalH: 100 });
    p.canvasW16 = 32;
    p.canvasH16 = 16;
    p.transform = { x16: 0, y16: 0, w16: 32, h16: 16, rotation: 0, flipX: false, flipY: false };
    p.textureDensity = 4;
    const r = computeRasterParams(p);
    expect(r.density).toBe(4);
    expect(r.canvasPx).toEqual({ w: 128, h: 64 });
    expect(r.imageDstPx).toEqual({ x: 0, y: 0, w: 128, h: 64 });
  });

  it('respects transform offsets (x16, y16) scaled by density', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 100, naturalH: 100 });
    p.canvasW16 = 32; p.canvasH16 = 32;
    p.transform = { x16: 4, y16: 8, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false };
    p.textureDensity = 2;
    const r = computeRasterParams(p);
    expect(r.imageDstPx).toEqual({ x: 8, y: 16, w: 32, h: 32 });
  });

  it('flips y16 to pixel-space top edge (Y-up convention)', () => {
    // y16 is the offset of the image's bottom edge from the canvas's bottom
    // edge. For a 16-tall image whose bottom is 8 px above the canvas bottom in
    // a 32-tall canvas, the image's top edge sits at pixel y = 32 - 8 - 16 = 8.
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 100, naturalH: 100 });
    p.canvasW16 = 32; p.canvasH16 = 32;
    p.transform = { x16: 0, y16: 8, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false };
    p.textureDensity = 1;
    const r = computeRasterParams(p);
    expect(r.imageDstPx).toEqual({ x: 0, y: 8, w: 16, h: 16 });
  });

  it('an image flush to the canvas bottom has pixel-space y = canvasH16 - h16', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 100, naturalH: 100 });
    p.canvasW16 = 32; p.canvasH16 = 32;
    p.transform = { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false };
    p.textureDensity = 1;
    const r = computeRasterParams(p);
    expect(r.imageDstPx).toEqual({ x: 0, y: 16, w: 16, h: 16 });
  });

  it('uses density=1 when no source for auto', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 100, naturalH: 100 });
    p.source = null;
    p.textureDensity = 'auto';
    expect(computeRasterParams(p).density).toBe(1);
  });
});

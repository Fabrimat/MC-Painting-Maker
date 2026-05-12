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

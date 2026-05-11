import { describe, it, expect } from 'vitest';
import { resolveDensity, nextPow2 } from './density';
import type { Painting } from './types';

function painting(overrides: Partial<Painting> = {}): Painting {
  return {
    id: 'p', name: 'p',
    canvasW16: 16, canvasH16: 16,
    source: { pngBase64: '', naturalW: 64, naturalH: 64 },
    transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
    resampling: 'smooth', textureDensity: 'auto', material: 'alphatest',
    ...overrides,
  };
}

describe('nextPow2', () => {
  it('returns 1 for n <= 1', () => {
    expect(nextPow2(0)).toBe(1);
    expect(nextPow2(1)).toBe(1);
  });
  it('rounds up to the nearest power of two', () => {
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(63)).toBe(64);
    expect(nextPow2(64)).toBe(64);
    expect(nextPow2(65)).toBe(128);
  });
});

describe('resolveDensity', () => {
  it('returns the manual value when not "auto"', () => {
    expect(resolveDensity(painting({ textureDensity: 4 }))).toBe(4);
  });
  it('returns 1 if no source (auto)', () => {
    expect(resolveDensity(painting({ source: null }))).toBe(1);
  });
  it('returns next pow2 of max(srcW/w16, srcH/h16) for auto', () => {
    const p = painting({
      source: { pngBase64: '', naturalW: 1000, naturalH: 1000 },
      transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
    });
    expect(resolveDensity(p)).toBe(64);
  });
  it('clamps auto to max 64', () => {
    const p = painting({
      source: { pngBase64: '', naturalW: 5000, naturalH: 5000 },
      transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
    });
    expect(resolveDensity(p)).toBe(64);
  });
  it('clamps auto to min 1', () => {
    const p = painting({
      source: { pngBase64: '', naturalW: 1, naturalH: 1 },
      transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
    });
    expect(resolveDensity(p)).toBe(1);
  });
});

import type { Painting } from './types';

export function nextPow2(n: number): number {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

export function resolveDensity(p: Painting): number {
  if (p.textureDensity !== 'auto') return p.textureDensity;
  if (!p.source) return 1;
  if (p.transform.w16 === 0 || p.transform.h16 === 0) return 1;
  const ratio = Math.max(
    p.source.naturalW / p.transform.w16,
    p.source.naturalH / p.transform.h16,
  );
  return Math.min(64, Math.max(1, nextPow2(Math.ceil(ratio))));
}

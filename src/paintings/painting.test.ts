import { describe, it, expect } from 'vitest';
import { applyPaintingPatch } from './painting';
import { createPaintingFromImage } from './defaults';
import { generatePaintingSlug, CURRENT_SLUG_VERSION } from './slug';
import type { Painting } from './types';

function fresh(name: string): Painting {
  return createPaintingFromImage(name, { pngBase64: '', naturalW: 32, naturalH: 32 });
}

describe('applyPaintingPatch', () => {
  it('rederivates slug from new name when unlocked', () => {
    const p = fresh('Sunset');
    expect(p.slugLocked).toBe(false);
    const next = applyPaintingPatch(p, { name: 'Mountain' });
    expect(next.name).toBe('Mountain');
    expect(next.slug).toBe(generatePaintingSlug('Mountain', p.id));
    expect(next.slugVersion).toBe(CURRENT_SLUG_VERSION);
  });

  it('preserves slug on rename when locked', () => {
    const p = { ...fresh('Sunset'), slugLocked: true };
    const before = p.slug;
    const next = applyPaintingPatch(p, { name: 'Mountain' });
    expect(next.name).toBe('Mountain');
    expect(next.slug).toBe(before);
    expect(next.slugLocked).toBe(true);
  });

  it('applies an explicit slug change verbatim regardless of lock state', () => {
    const p = fresh('Sunset');
    const next = applyPaintingPatch(p, { slug: 'custom_value', slugLocked: true });
    expect(next.slug).toBe('custom_value');
    expect(next.slugLocked).toBe(true);
  });

  it('rederivates slug when toggling locked to unlocked', () => {
    const p = { ...fresh('Sunset'), name: 'Mountain', slug: 'frozen_xxx', slugLocked: true };
    const next = applyPaintingPatch(p, { slugLocked: false });
    expect(next.slugLocked).toBe(false);
    expect(next.slug).toBe(generatePaintingSlug('Mountain', p.id));
  });

  it('keeps the current slug when toggling unlocked to locked', () => {
    const p = fresh('Sunset');
    const before = p.slug;
    const next = applyPaintingPatch(p, { slugLocked: true });
    expect(next.slugLocked).toBe(true);
    expect(next.slug).toBe(before);
  });

  it('does not touch slug for patches that change unrelated fields', () => {
    const p = fresh('Sunset');
    const before = p.slug;
    const next = applyPaintingPatch(p, { canvasW16: 64 });
    expect(next.slug).toBe(before);
    expect(next.canvasW16).toBe(64);
  });

  it('rederivates from new name when name and slugLocked=false are patched together', () => {
    const p = { ...fresh('Sunset'), slugLocked: true };
    const next = applyPaintingPatch(p, { name: 'Mountain', slugLocked: false });
    expect(next.slug).toBe(generatePaintingSlug('Mountain', p.id));
    expect(next.slugLocked).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  sanitizeId,
  entityId,
  paintingFileBase,
  paintingItemId,
  paintingIconTextureKey,
  paintingNameSlug,
  geometryName,
  renderControllerName,
} from './identifiers';

const P = { slug: 'sunset_a3f8b1c2' };

describe('identifiers', () => {
  it('sanitizes a UUID to snake_case', () => {
    expect(sanitizeId('a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('a3f8b1c2_1234_5678_9abc_deadbeefcafe');
  });

  it('paintingFileBase returns the painting slug verbatim', () => {
    expect(paintingFileBase(P)).toBe('sunset_a3f8b1c2');
  });

  it('builds the entity identifier as <ns>:<slug>', () => {
    expect(entityId('myart', P)).toBe('myart:sunset_a3f8b1c2');
  });

  it('builds the painting item id as <entityId>_painting', () => {
    expect(paintingItemId('myart', P)).toBe('myart:sunset_a3f8b1c2_painting');
  });

  it('builds the icon texture key as <slug>_icon', () => {
    expect(paintingIconTextureKey(P)).toBe('sunset_a3f8b1c2_icon');
  });

  it('strips the trailing UUID8 to expose a clean name slug for lang keys', () => {
    expect(paintingNameSlug({ slug: 'sunset_a3f8b1c2' })).toBe('sunset');
    expect(paintingNameSlug({ slug: 'p_2_b4f9c2d3' })).toBe('p_2');
    expect(paintingNameSlug({ slug: 'p_a3f8b1c2' })).toBe('p');
  });

  it('builds the geometry name with the geometry. prefix', () => {
    expect(geometryName(P)).toBe('geometry.sunset_a3f8b1c2');
  });

  it('builds the render controller name with the controller.render. prefix', () => {
    expect(renderControllerName(P)).toBe('controller.render.sunset_a3f8b1c2');
  });
});

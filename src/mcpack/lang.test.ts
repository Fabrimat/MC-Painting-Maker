import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildBpLang, buildRpLang } from './lang';
import { paintingFileBase } from './identifiers';

describe('lang', () => {
  it('builds the BP lang with group + both spawn egg name key forms', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildBpLang(proj);
    expect(lang).toContain(`itemGroup.name.paintings:paintings=Custom Paintings`);
    // Modern Bedrock form
    expect(lang).toContain(`item.spawn_egg.entity.paintings:${paintingFileBase(p.id)}.name=Sunset`);
    // Fallback form for older versions
    expect(lang).toContain(`item.paintings:${paintingFileBase(p.id)}_spawn_egg.name=Sunset`);
  });

  it('builds the RP lang with entity name + both spawn egg name forms', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildRpLang(proj);
    // Entity name (mob name)
    expect(lang).toContain(`entity.paintings:${paintingFileBase(p.id)}.name=Sunset`);
    // Spawn egg names — duplicated into RP lang because vanilla Bedrock resolves item
    // display names from the resource pack, not the behavior pack.
    expect(lang).toContain(`item.spawn_egg.entity.paintings:${paintingFileBase(p.id)}.name=Sunset`);
    expect(lang).toContain(`item.paintings:${paintingFileBase(p.id)}_spawn_egg.name=Sunset`);
    // Creative group name — duplicated so that anything reading from the RP also finds it.
    expect(lang).toContain('itemGroup.name.paintings:paintings=Custom Paintings');
  });

  it('BP and RP lang files contain the same keys (duplication for safety)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    expect(buildBpLang(proj)).toBe(buildRpLang(proj));
  });

  it('emits pack.name and pack.description in the BP lang for the manifest placeholders', () => {
    const proj = createEmptyProject();
    proj.pack.name = 'My Cool Pack';
    proj.pack.description = 'A short description.';
    const lang = buildBpLang(proj);
    expect(lang).toContain('pack.name=My Cool Pack');
    expect(lang).toContain('pack.description=A short description.');
  });

  it('emits pack.name and pack.description in the RP lang for the manifest placeholders', () => {
    const proj = createEmptyProject();
    proj.pack.name = 'My Cool Pack';
    proj.pack.description = 'A short description.';
    const lang = buildRpLang(proj);
    expect(lang).toContain('pack.name=My Cool Pack');
    expect(lang).toContain('pack.description=A short description.');
  });

  it('flattens newlines in lang values so the .lang file stays parseable', () => {
    const proj = createEmptyProject();
    proj.pack.name = 'Line one\nLine two';
    const lang = buildBpLang(proj);
    expect(lang).toContain('pack.name=Line one Line two');
    expect(lang).not.toContain('Line one\nLine two');
  });
});

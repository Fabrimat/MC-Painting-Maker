import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildBpLang, buildRpLang } from './lang';
import { paintingFileBase } from './identifiers';

describe('lang', () => {
  it('builds the BP lang with group + spawn egg names', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildBpLang(proj);
    expect(lang).toContain(`itemGroup.name.paintings:paintings=Custom Paintings`);
    const expected = `item.spawn_egg.entity.paintings:${paintingFileBase(p.id)}.name=Sunset`;
    expect(lang).toContain(expected);
  });

  it('builds the RP lang with entity name keys', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildRpLang(proj);
    const expected = `entity.paintings:${paintingFileBase(p.id)}.name=Sunset`;
    expect(lang).toContain(expected);
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

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
    const expected = `item.paintings:${paintingFileBase(p.id)}_spawn_egg.name=Sunset`;
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
});

import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildBpLang, buildRpLang } from './lang';

describe('lang', () => {
  it('builds the BP lang with group + spawn egg names', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildBpLang(proj);
    expect(lang).toContain(`itemGroup.name.paintings:paintings=Custom Paintings`);
    const expected = `item.paintings:painting_${p.id.replace(/-/g, '_')}_spawn_egg.name=Sunset`;
    expect(lang).toContain(expected);
  });

  it('builds the RP lang with entity name keys', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildRpLang(proj);
    const expected = `entity.paintings:painting_${p.id.replace(/-/g, '_')}.name=Sunset`;
    expect(lang).toContain(expected);
  });
});

import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildBpLang, buildRpLang } from './lang';
import { paintingFileBase } from './identifiers';

describe('lang', () => {
  it('builds the BP lang with group keys (raw + legacy) and UUID-free item name key', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildBpLang(proj);
    // Modern form (Microsoft docs): the full group name doubles as the lang key.
    expect(lang).toContain('paintings:paintings=Custom Paintings');
    // Legacy form for older Bedrock versions.
    expect(lang).toContain('itemGroup.name.paintings:paintings=Custom Paintings');
    // Item display name key uses the painting's name slug, not the full slug.
    expect(lang).toContain('item.paintings:sunset_painting.name=Sunset');
    // The UUID suffix from the painting slug must NOT leak into the item key
    // (entity.* lines still carry the full id - that's required by Bedrock).
    const slug = paintingFileBase(p);
    expect(slug).toMatch(/_[0-9a-f]{8}$/);
    const itemLines = lang.split('\n').filter((l) => l.startsWith('item.'));
    expect(itemLines.join('\n')).not.toContain(slug);
    // No more spawn-egg keys - the placer item replaces the auto spawn egg.
    expect(lang).not.toContain('spawn_egg');
  });

  it('builds the RP lang with entity name + UUID-free item name key', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildRpLang(proj);
    // Entity name must use the full slug because Bedrock looks it up by exact id.
    expect(lang).toContain(`entity.paintings:${paintingFileBase(p)}.name=Sunset`);
    // Custom item display name - UUID-free for readability.
    expect(lang).toContain('item.paintings:sunset_painting.name=Sunset');
    // Creative group name - both forms, duplicated so the RP lookup also finds them.
    expect(lang).toContain('paintings:paintings=Custom Paintings');
    expect(lang).toContain('itemGroup.name.paintings:paintings=Custom Paintings');
    expect(lang).not.toContain('spawn_egg');
  });

  it('does not emit duplicate item lang keys when paintings normalize to the same slug', () => {
    const proj = createEmptyProject();
    const a = createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 });
    const b = createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(a, b);
    const lang = buildBpLang(proj);
    const matches = lang.match(/^item\.paintings:sunset_painting\.name=/gm) ?? [];
    expect(matches).toHaveLength(1);
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

  it('v2 (legacy): emits only the legacy itemGroup.name form plus spawn-egg display names', () => {
    const proj = { ...createEmptyProject(), version: 2 as const };
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildBpLang(proj);
    const eid = `paintings:${paintingFileBase(p)}`;
    // Legacy form only - the modern raw-group form is reserved for v3 builds.
    expect(lang).toContain('itemGroup.name.paintings:paintings=Custom Paintings');
    expect(lang.split('\n')).not.toContain('paintings:paintings=Custom Paintings');
    // Both documented spawn-egg display-name forms.
    expect(lang).toContain(`item.spawn_egg.entity.${eid}.name=Sunset`);
    expect(lang).toContain(`item.${eid}_spawn_egg.name=Sunset`);
    // No placer-item lang key in legacy mode.
    expect(lang).not.toContain('item.paintings:sunset_painting.name=');
  });
});

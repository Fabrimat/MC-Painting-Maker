import { describe, it, expect } from 'vitest';
import { buildVersionMcfunction, versionMcfunctionPath, versionFunctionCommand } from './version';

describe('buildVersionMcfunction', () => {
  it('embeds the sha and date in header comments and tellraw lines', () => {
    const out = buildVersionMcfunction({ buildSha: 'abc1234', buildDate: '2026-05-22T20:30:00Z' });
    expect(out).toContain('# build: abc1234');
    expect(out).toContain('# generated: 2026-05-22T20:30:00Z');
    expect(out).toContain('tellraw @s {"rawtext":[{"text":"[paintings] build abc1234"}]}');
    expect(out).toContain('tellraw @s {"rawtext":[{"text":"[paintings] generated 2026-05-22T20:30:00Z"}]}');
  });

  it('falls back to "unknown" when the sha or date is empty (e.g. tests, sandboxes)', () => {
    const out = buildVersionMcfunction({ buildSha: '', buildDate: '' });
    expect(out).toContain('# build: unknown');
    expect(out).toContain('# generated: unknown');
  });
});

describe('versionMcfunctionPath', () => {
  it('namespaces under <ns>/version to avoid colliding with other addons', () => {
    expect(versionMcfunctionPath('paintings')).toBe('BP_paintings/functions/paintings/version.mcfunction');
    expect(versionMcfunctionPath('myart')).toBe('BP_myart/functions/myart/version.mcfunction');
  });
});

describe('versionFunctionCommand', () => {
  it('matches the path so the in-game command is predictable', () => {
    expect(versionFunctionCommand('paintings')).toBe('/function paintings/version');
  });
});

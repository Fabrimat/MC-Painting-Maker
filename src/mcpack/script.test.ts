import { describe, it, expect } from 'vitest';
import { buildMainJs } from './script';

describe('buildMainJs', () => {
  it('embeds the namespace family name', () => {
    const code = buildMainJs('myart');
    expect(code).toContain('const FAMILY = "myart_painting"');
  });

  it('imports from @minecraft/server', () => {
    expect(buildMainJs('a')).toContain('from "@minecraft/server"');
  });

  it('subscribes to entitySpawn and snaps rotation by 90°', () => {
    const code = buildMainJs('a');
    expect(code).toContain('afterEvents.entitySpawn.subscribe');
    expect(code).toContain('Math.round(');
  });

  it('guards entity calls with isValid checks and filters by family', () => {
    const code = buildMainJs('a');
    expect(code).toContain('e?.isValid');
    expect(code).toContain('e.matches({ families: [FAMILY] })');
    // isValid is consulted before every entity method invocation, not just once.
    expect(code.match(/isValid/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

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
});

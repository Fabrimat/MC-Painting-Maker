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

  it('snaps pitch (r.x) to multiples of 90 and clamps to [-90, 90]', () => {
    const code = buildMainJs('a');
    // The script reads r.x and applies the same round-to-90 logic as yaw.
    expect(code).toMatch(/Math\.round\s*\(\s*r\.x\s*\/\s*90\s*\)\s*\*\s*90/);
    // Pitch is clamped to the valid Bedrock range.
    expect(code).toContain('Math.max(-90');
    expect(code).toContain('Math.min(90');
  });

  it('passes the snapped pitch to setRotation (no longer hardcoded to 0)', () => {
    const code = buildMainJs('a');
    // setRotation receives a snapped x, not the literal 0 used previously.
    expect(code).toMatch(/setRotation\s*\(\s*\{[^}]*x:\s*snappedX/);
    expect(code).toMatch(/setRotation\s*\(\s*\{[^}]*y:\s*snappedY/);
  });

  it('triggers set_flat_orient when the snapped pitch is +/-90', () => {
    const code = buildMainJs('a');
    expect(code).toContain('triggerEvent("set_flat_orient")');
    // The trigger is gated by |snappedX| === 90 so wall placements are not affected.
    expect(code).toMatch(/Math\.abs\s*\(\s*snappedX\s*\)\s*===\s*90/);
  });
});

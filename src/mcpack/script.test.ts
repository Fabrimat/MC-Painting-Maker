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

  it('subscribes to playerInteractWithBlock to capture the placement block face', () => {
    const code = buildMainJs('a');
    // entity_placer does not propagate the player's pitch to the spawned
    // entity, so block face is captured from the interaction event instead.
    expect(code).toContain('afterEvents.playerInteractWithBlock.subscribe');
    expect(code).toContain('event.blockFace');
  });

  it('filters interactions to painting placer items by namespace prefix and _painting suffix', () => {
    const code = buildMainJs('myart');
    expect(code).toContain('const ITEM_NS = "myart:"');
    expect(code).toContain('const ITEM_SUFFIX = "_painting"');
    expect(code).toMatch(/typeId\.startsWith\(ITEM_NS\)/);
    expect(code).toMatch(/typeId\.endsWith\(ITEM_SUFFIX\)/);
  });

  it('maps blockFace Up to +90 and Down to -90, other faces stay at 0', () => {
    const code = buildMainJs('a');
    expect(code).toMatch(/intent\.face === "Up"[\s\S]*snappedX = 90/);
    expect(code).toMatch(/intent\.face === "Down"[\s\S]*snappedX = -90/);
    // Default (wall placement) is an explicit pitch of 0.
    expect(code).toMatch(/let\s+snappedX\s*=\s*0/);
  });

  it('passes the resolved pitch to setRotation (no longer hardcoded to 0)', () => {
    const code = buildMainJs('a');
    expect(code).toMatch(/setRotation\s*\(\s*\{[^}]*x:\s*snappedX/);
    expect(code).toMatch(/setRotation\s*\(\s*\{[^}]*y:\s*snappedY/);
  });

  it('triggers set_flat_orient when the snapped pitch is +/-90', () => {
    const code = buildMainJs('a');
    expect(code).toContain('triggerEvent("set_flat_orient")');
    // The trigger is gated by |snappedX| === 90 so wall placements are not affected.
    expect(code).toMatch(/Math\.abs\s*\(\s*snappedX\s*\)\s*===\s*90/);
  });

  it('consumes the intent on matching entitySpawn so it is not reused', () => {
    const code = buildMainJs('a');
    // takeIntentFor must remove the picked intent from the map; otherwise
    // a stale block face would leak into a later unrelated painting spawn.
    expect(code).toMatch(/intents\.delete\(/);
  });
});

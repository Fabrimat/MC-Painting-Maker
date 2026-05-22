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

  it('subscribes to entitySpawn (via the safe wrapper) and snaps rotation by 90°', () => {
    const code = buildMainJs('a');
    expect(code).toContain('safeSubscribe("entitySpawn"');
    expect(code).toContain('world.afterEvents.entitySpawn');
    expect(code).toContain('Math.round(');
  });

  it('guards entity calls with isValid checks and filters by family', () => {
    const code = buildMainJs('a');
    expect(code).toContain('e?.isValid');
    expect(code).toContain('e.matches({ families: [FAMILY] })');
    // isValid is consulted before every entity method invocation, not just once.
    expect(code.match(/isValid/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('captures intent on BEFORE events so it lands before entity_placer fires entitySpawn', () => {
    const code = buildMainJs('a');
    // entity_placer does not propagate the player's pitch to the spawned
    // entity, so block face is captured from the interaction event. In this
    // Bedrock runtime entitySpawn fires before afterEvents.playerInteractWithBlock,
    // so we must hook the BEFORE variants - those fire synchronously
    // before the engine commits the interaction.
    expect(code).toContain('safeSubscribe("beforePlayerInteractWithBlock"');
    expect(code).toContain('world.beforeEvents.playerInteractWithBlock');
    expect(code).toContain('safeSubscribe("beforeItemUseOn"');
    expect(code).toContain('event.blockFace');
  });

  it('keeps after-event subscriptions for diagnostics only (no intent storage)', () => {
    const code = buildMainJs('a', { debug: true });
    // The after-event handlers must NOT call storeIntent - their job is
    // purely to log that the engine routed the click through that event at
    // all, so a missing log surfaces a runtime that skips the event entirely.
    const afterPlayerSection = code.slice(
      code.indexOf('safeSubscribe("afterPlayerInteractWithBlock"'),
      code.indexOf('safeSubscribe("afterItemUseOn"'),
    );
    expect(afterPlayerSection).not.toContain('storeIntent');
    expect(afterPlayerSection).toContain('diagnostic only');
  });

  it('wraps event subscriptions with feature-detection so a missing API never crashes the script', () => {
    const code = buildMainJs('a', { debug: true });
    // safeSubscribe must short-circuit when source is undefined or its
    // .subscribe is missing - otherwise one bad event handle takes down
    // every other listener registered later in the file.
    expect(code).toContain('function safeSubscribe(name, source, handler)');
    expect(code).toMatch(/typeof source\.subscribe !== "function"/);
    expect(code).toContain('dbg("event api missing"');
  });

  it('filters non-painting entitySpawn events early so debug builds do not spam the world', () => {
    const code = buildMainJs('a', { debug: true });
    // The family check must precede any dbg() in the entitySpawn handler.
    // Otherwise every animal, projectile and dropped item spawn would log.
    const spawnHandler = code.slice(code.indexOf('safeSubscribe("entitySpawn"'));
    const familyCheckIdx = spawnHandler.indexOf('e.matches({ families: [FAMILY] })');
    const firstDbgIdx = spawnHandler.indexOf('dbg(');
    expect(familyCheckIdx).toBeGreaterThan(0);
    expect(firstDbgIdx).toBeGreaterThan(familyCheckIdx);
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

  it('defaults to a no-op dbg helper when debug is off (release build is silent)', () => {
    const code = buildMainJs('a');
    expect(code).toContain('function dbg() {}');
    // No chat or content-log broadcast in release mode.
    expect(code).not.toContain('world.sendMessage');
    expect(code).not.toContain('console.warn');
  });

  it('emits an in-game debug helper when opts.debug is true', () => {
    const code = buildMainJs('a', { debug: true });
    // The helper is a real function (not the no-op) that broadcasts to chat
    // AND to the content log so devs can correlate events.
    expect(code).toMatch(/function dbg\(label, data\)\s*\{/);
    expect(code).toContain('world.sendMessage');
    expect(code).toContain('console.warn');
    expect(code).toContain('[paintings-dbg]');
  });

  it('emits a header marker exposing the debug flag, sha and date for off-line inspection', () => {
    // The user can unzip the .mcaddon and read scripts/main.js to confirm
    // which build they have, without having to interpret in-game silence.
    expect(buildMainJs('a')).toContain('// debug: false');
    expect(buildMainJs('a', { debug: true })).toContain('// debug: true');
    expect(buildMainJs('a')).toContain('// paintings-addon main.js');
    const stamped = buildMainJs('a', { buildSha: 'abc1234', buildDate: '2026-05-22T20:30:00Z' });
    expect(stamped).toContain('// build: abc1234');
    expect(stamped).toContain('// generated: 2026-05-22T20:30:00Z');
    expect(buildMainJs('a')).toContain('// build: unknown');
  });

  it('instruments key paths in debug builds (events, intent, spawn, setRotation, trigger)', () => {
    const code = buildMainJs('a', { debug: true });
    // The exact strings here are the labels surfaced to the dev in chat, so
    // they should be greppable and stable across small refactors.
    expect(code).toContain('dbg("script loaded"');
    expect(code).toContain('dbg("beforePlayerInteractWithBlock"');
    expect(code).toContain('dbg("beforeItemUseOn"');
    expect(code).toContain('dbg("intent stored"');
    expect(code).toContain('dbg("painting spawned"');
    expect(code).toContain('dbg("setRotation"');
    expect(code).toContain('dbg("triggered set_flat_orient")');
  });
});

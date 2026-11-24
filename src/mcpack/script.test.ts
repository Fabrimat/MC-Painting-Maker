import { describe, it, expect } from 'vitest';
import { ORIENTED_DIRS } from './entity';
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

  it('picks one of 12 oriented event names from face + yaw (4 cardinals x 3 surfaces)', () => {
    const code = buildMainJs('a');
    // Direction lookup tables in the generated script.
    // DIRS is index-aligned with the entity's ORIENTED_DIRS (d = yaw steps).
    expect(code).toContain(`const DIRS = ${JSON.stringify(ORIENTED_DIRS)}`);
    // A wall painting faces the clicked face's normal: d=0 faces south, etc.
    expect(code).toContain('const FACE_TO_D = { South: 0, West: 1, North: 2, East: 3 }');
    ORIENTED_DIRS.forEach((dir, d) => {
      const face = dir[0].toUpperCase() + dir.slice(1);
      expect(code).toContain(`${face}: ${d}`);
    });
    // Floor/ceiling branches derive direction from the snapped spawn yaw.
    expect(code).toMatch(/intent\.face === "Up"[\s\S]*surface = "floor"[\s\S]*d = \(\(Math\.round\(snappedY \/ 90\)/);
    // The entity itself always stays at yaw 0 (yaw is rendered by animation).
    expect(code).toContain('e.setRotation({ x: 0, y: 0 })');
    expect(code).toMatch(/intent\.face === "Down"[\s\S]*surface = "ceiling"/);
    // Wall branch picks direction from the block face that was clicked.
    expect(code).toContain('FACE_TO_D[String(intent.face)]');
    // Single trigger site builds the event name from surface + direction.
    expect(code).toContain('"set_oriented_" + surface + "_" + dir');
  });

  it('keeps the entity pitch at 0 - rotation is driven by the client-side animation, not setRotation', () => {
    const code = buildMainJs('a');
    // Bedrock does not render the entity pitch on inanimate entities, so
    // setting x via setRotation has no visual effect. The orient controller
    // reads mark_variant via Molang and rotates the root bone instead.
    expect(code).toMatch(/setRotation\s*\(\s*\{\s*x:\s*0\s*,/);
    expect(code).not.toMatch(/setRotation\s*\(\s*\{[^}]*x:\s*snappedX/);
  });

  it('drops the legacy surface-only event names in favour of directional ones', () => {
    const code = buildMainJs('a');
    // Legacy generic events from before the per-direction split would route
    // to nothing and the painting would silently end up without a hitbox.
    expect(code).not.toContain('set_flat_orient');
    expect(code).not.toContain('"set_oriented_wall"');
    expect(code).not.toContain('"set_oriented_floor"');
    expect(code).not.toContain('"set_oriented_ceiling"');
  });

  it('does not teleport the entity after spawn (position offsets are handled in the orient animation)', () => {
    const code = buildMainJs('a');
    // The shared painting_orient animation translates the root bone to put
    // the painting flush on the clicked face, so the script no longer
    // needs to teleport ceiling spawns.
    expect(code).not.toContain('teleport');
    expect(code).not.toContain('faceLocation');
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
    expect(code).toMatch(/dbg\("respawned with " \+ eventName/);
    // Hit diagnostics are debug-only.
    expect(code).toContain('dbg("entityHitBlock (swing missed any entity)"');
    expect(buildMainJs('a')).not.toContain('entityHitBlock');
  });

  it('respawns the placed painting with the orientation event applied at spawn', () => {
    // custom_hit_test only reaches clients with the initial spawn data, so a
    // group added afterwards leaves the painting unclickable (seen in-game).
    const code = buildMainJs('a');
    expect(code).toContain('e.dimension.spawnEntity(e.typeId, e.location, { initialRotation: 0, spawnEvent: eventName })');
    expect(code).toContain('e.remove()');
    // The replacement's own spawn event must not loop or consume intents:
    // the guard runs before takeIntentFor.
    const guard = code.indexOf('if (replacements.delete(e.id) || markVariantOf(e) > 0) return;');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(code.indexOf('const intent = takeIntentFor(e)'));
  });
});

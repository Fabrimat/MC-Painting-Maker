import { ORIENTED_DIRS } from './entity';

export function buildMainJs(
  namespace: string,
  opts: {
    debug?: boolean; buildSha?: string; buildDate?: string;
    breakInSurvival?: boolean; breakInAdventure?: boolean;
  } = {},
): string {
  const debug = !!opts.debug;
  const breakInSurvival = opts.breakInSurvival ?? true;
  const breakInAdventure = opts.breakInAdventure ?? false;
  const buildSha = opts.buildSha || 'unknown';
  const buildDate = opts.buildDate || 'unknown';
  // In debug builds the addon broadcasts diagnostic lines to chat (visible to
  // every player) AND to the content log via console.warn. The no-op variant
  // keeps the call sites identical so the rest of the file is one shape.
  const dbgImpl = debug
    ? `function dbg(label, data) {
  let payload = "";
  if (data !== undefined) {
    try { payload = " " + JSON.stringify(data); } catch { payload = " " + String(data); }
  }
  try { world.sendMessage(\`[paintings-dbg] \${label}\${payload}\`); } catch {}
  try { console.warn(\`[paintings-dbg] \${label}\${payload}\`); } catch {}
}`
    : `function dbg() {}`;

  // Header marker visible by unzipping the .mcaddon: when the user reports
  // "debug doesn't work", reading scripts/main.js confirms which build it is
  // (no need to interpret in-game silence as a code bug vs a stale cache).
  // The same sha/date are printed in-game by /function <ns>/version.
  return `// paintings-addon main.js
// build: ${buildSha}
// generated: ${buildDate}
// debug: ${debug}
import { world, ItemStack } from "@minecraft/server";

const FAMILY = "${namespace}_painting";
const ITEM_NS = "${namespace}:";
const ITEM_SUFFIX = "_painting";
const INTENT_WINDOW_MS = 500;
// Pack settings: can Survival / Adventure players break placed paintings?
const BREAK_IN_SURVIVAL = ${breakInSurvival};
const BREAK_IN_ADVENTURE = ${breakInAdventure};

${dbgImpl}

dbg("script loaded", { family: FAMILY, debug: ${debug} });

// Bedrock SDK shape varies across module versions: itemUseOn was added,
// renamed and re-homed several times. Subscribing to a missing event
// crashes the whole script at module load, so feature-detect first and
// only register handlers for APIs that actually exist in this runtime.
function safeSubscribe(name, source, handler) {
  if (!source || typeof source.subscribe !== "function") {
    dbg("event api missing", { event: name });
    return false;
  }
  try {
    source.subscribe(handler);
    dbg("subscribed", { event: name });
    return true;
  } catch (e) {
    dbg("subscribe failed", { event: name, error: String(e) });
    return false;
  }
}

// minecraft:entity_placer spawns the entity with pitch=0 regardless of which
// face was clicked, so the placement orientation cannot be recovered from
// the spawned entity. Track the block face of every interaction and consume
// one per matching entitySpawn (same tick). A list, not one slot per player:
// a single click can fire the interaction twice and spawn two paintings
// (seen in-game), and each spawn needs its own intent to know its face and
// who placed it.
const intents = [];

function isPlacerItem(typeId) {
  return typeof typeId === "string"
    && typeId.startsWith(ITEM_NS)
    && typeId.endsWith(ITEM_SUFFIX);
}

function storeIntent(playerId, blockFace, via) {
  intents.push({ face: blockFace, t: Date.now(), playerId });
  dbg("intent stored", { playerId, face: String(blockFace), via, size: intents.length });
}

// Intent capture must happen on a BEFORE event: in this Bedrock runtime
// world.afterEvents.entitySpawn fires *before* afterEvents.playerInteractWithBlock
// for an entity_placer activation, which means an after-event handler
// stores the intent too late - the spawn handler already ran with an empty
// map. beforeEvents fire synchronously before the engine commits the
// interaction, so the intent is in place when entitySpawn arrives.
safeSubscribe("beforePlayerInteractWithBlock", world.beforeEvents && world.beforeEvents.playerInteractWithBlock, (event) => {
  const stack = event.itemStack;
  if (!stack) return;
  const matched = isPlacerItem(stack.typeId);
  dbg("beforePlayerInteractWithBlock", { item: stack.typeId, matched, face: String(event.blockFace), player: event.player.name });
  if (!matched) return;
  storeIntent(event.player.id, event.blockFace, "beforeInteract");
});

safeSubscribe("beforeItemUseOn", world.beforeEvents && world.beforeEvents.itemUseOn, (event) => {
  const stack = event.itemStack;
  if (!stack) return;
  const matched = isPlacerItem(stack.typeId);
  dbg("beforeItemUseOn", { item: stack.typeId, matched, face: String(event.blockFace), player: event.source && event.source.name });
  if (!matched || !event.source) return;
  storeIntent(event.source.id, event.blockFace, "beforeItemUseOn");
});

// After-event subscriptions are kept for diagnostics only - they fire too
// late to influence the spawn but confirm the engine actually routed the
// click through these events at all.
safeSubscribe("afterPlayerInteractWithBlock", world.afterEvents && world.afterEvents.playerInteractWithBlock, (event) => {
  const stack = event.itemStack;
  if (!stack || !isPlacerItem(stack.typeId)) return;
  dbg("afterPlayerInteractWithBlock (post-spawn, diagnostic only)", { face: String(event.blockFace) });
});

safeSubscribe("afterItemUseOn", world.afterEvents && world.afterEvents.itemUseOn, (event) => {
  const stack = event.itemStack;
  if (!stack || !isPlacerItem(stack.typeId)) return;
  dbg("afterItemUseOn (post-spawn, diagnostic only)", { face: String(event.blockFace) });
});
${debug ? `
// Debug-only hit diagnostics: tell whether a player's swing reached the
// painting entity (entityHitEntity/entityHurt) or went through it to the
// block behind (entityHitBlock), and whether the despawn actually ran.
const fmtV = (v) => v ? { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) } : null;
safeSubscribe("entityHitEntity", world.afterEvents && world.afterEvents.entityHitEntity, (event) => {
  const t = event.hitEntity;
  dbg("entityHitEntity", { by: event.damagingEntity && event.damagingEntity.typeId, target: t && t.typeId, at: t && t.isValid ? fmtV(t.location) : null });
});
safeSubscribe("entityHitBlock", world.afterEvents && world.afterEvents.entityHitBlock, (event) => {
  if (!event.damagingEntity || event.damagingEntity.typeId !== "minecraft:player") return;
  const b = event.hitBlock;
  dbg("entityHitBlock (swing missed any entity)", { block: b && b.typeId, at: b ? fmtV(b.location) : null, face: String(event.blockFace) });
});
safeSubscribe("entityHurt", world.afterEvents && world.afterEvents.entityHurt, (event) => {
  const e = event.hurtEntity;
  if (!e || !e.isValid || !e.matches({ families: [FAMILY] })) return;
  dbg("entityHurt", { typeId: e.typeId, cause: String(event.damageSource && event.damageSource.cause) });
});
safeSubscribe("entityRemove", world.beforeEvents && world.beforeEvents.entityRemove, (event) => {
  const e = event.removedEntity;
  if (!e || !e.matches({ families: [FAMILY] })) return;
  dbg("entityRemove", { typeId: e.typeId, at: fmtV(e.location) });
});
` : ''}
function takeIntentFor(entity) {
  const now = Date.now();
  // Drop expired intents first.
  for (let i = intents.length - 1; i >= 0; i--) {
    if (now - intents[i].t > INTENT_WINDOW_MS) intents.splice(i, 1);
  }
  if (intents.length === 0) return null;
  const pos = entity.location;
  const players = world.getAllPlayers();
  // Nearest placing player wins; ties keep the oldest intent. An intent whose
  // player has gone (dist=Infinity) still wins when it is the only one.
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  intents.forEach((value, i) => {
    const player = players.find((p) => p.id === value.playerId);
    const dist = player
      ? (player.location.x - pos.x) ** 2 + (player.location.y - pos.y) ** 2 + (player.location.z - pos.z) ** 2
      : Number.POSITIVE_INFINITY;
    if (best === -1 || dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return intents.splice(best, 1)[0];
}

// Ids of the oriented replacements spawned below, so their own entitySpawn
// event is ignored (the mark_variant check is the fallback when the event
// fires before spawnEntity returns).
const replacements = new Set();

function markVariantOf(entity) {
  try {
    const c = entity.getComponent("minecraft:mark_variant");
    return c ? c.value : 0;
  } catch {
    return 0;
  }
}

const VARIANT_BASE = { wall: 11, floor: 21, ceiling: 31 };

function isSpotTaken(e, surface, d) {
  const cell = { x: Math.floor(e.location.x), y: Math.floor(e.location.y), z: Math.floor(e.location.z) };
  const base = VARIANT_BASE[surface];
  let others = [];
  try {
    others = e.dimension.getEntities({
      families: [FAMILY],
      location: { x: cell.x + 0.5, y: cell.y + 0.5, z: cell.z + 0.5 },
      maxDistance: 1,
    });
  } catch {
    return false;
  }
  return others.some((o) => {
    if (o.id === e.id || !o.isValid) return false;
    const l = o.location;
    if (Math.floor(l.x) !== cell.x || Math.floor(l.y) !== cell.y || Math.floor(l.z) !== cell.z) return false;
    const v = markVariantOf(o);
    // Walls clash only on the same side; floor/ceiling clash in any direction.
    return surface === "wall" ? v === base + d : v >= base && v <= base + 3;
  });
}

// Give the consumed placer item back (not in Creative, where none was used).
function refundPlacerItem(player, entityTypeId) {
  try {
    if (String(player.getGameMode()).toLowerCase() === "creative") return;
    const item = new ItemStack(entityTypeId + ITEM_SUFFIX, 1);
    const inv = player.getComponent("minecraft:inventory");
    const left = inv && inv.container ? inv.container.addItem(item) : item;
    if (left) player.dimension.spawnItem(left, player.location);
  } catch (err) {
    dbg("refund failed", { error: String(err) });
  }
  try { player.onScreenDisplay.setActionBar("There is already a painting here"); } catch {}
}

safeSubscribe("entitySpawn", world.afterEvents && world.afterEvents.entitySpawn, (event) => {
  const e = event.entity;
  // The entity may already have been removed by the time this handler runs
  // (unloaded chunk, immediate /kill, race with other scripts). Calling any
  // method on an invalid entity throws InvalidEntityError, so always gate.
  if (!e?.isValid) return;
  // Filter early so non-painting spawns (animals, projectiles, every dropped
  // item) never reach the debug logger - the chat would be unreadable.
  if (!e.matches({ families: [FAMILY] })) return;
  if (!e.isValid) return;
  // Already oriented (our own replacement below, or /summon with an event):
  // nothing to do. Checked BEFORE takeIntentFor so a replacement spawn can
  // never steal another player's pending intent.
  if (replacements.delete(e.id) || markVariantOf(e) > 0) return;
  const r = e.getRotation();
  const snappedY = Math.round(r.y / 90) * 90;
  const intent = takeIntentFor(e);
  dbg("painting spawned", {
    typeId: e.typeId,
    cause: String(event.cause),
    rawRotation: { x: r.x, y: r.y },
    intent: intent ? { face: String(intent.face), ageMs: Date.now() - intent.t } : null,
    intentsLeft: intents.length,
  });
  // The entity is ALWAYS kept at yaw 0 (and pitch 0): the painting's yaw and
  // floor/ceiling pitch are applied client-side by the orient animations,
  // driven by mark_variant. Keeping the real yaw at 0 means custom_hit_test
  // pivots are never rotated by the engine, so the pre-rotated hitboxes in
  // each oriented_* component group land exactly on the rendered painting.
  if (!e.isValid) return;
  e.setRotation({ x: 0, y: 0 });
  dbg("setRotation", { x: 0, y: 0 });
  // d = number of +90 deg yaw steps (0..3). Labels = direction the painting
  // front faces: d=0 south, 1 west, 2 north, 3 east. A wall painting's front
  // must face the clicked face's normal, so walls take d from the face (never
  // from the player's look direction, which can be up to 90 deg off when
  // clicking a wall obliquely). Floor/ceiling take d from the spawn yaw
  // snapped to a cardinal. Without an intent (e.g. /summon) default to d=0.
  const DIRS = ${JSON.stringify(ORIENTED_DIRS)};
  const FACE_TO_D = { South: 0, West: 1, North: 2, East: 3 };
  let surface = "wall";
  let d = 0;
  if (intent && intent.face === "Up") {
    surface = "floor";
    d = ((Math.round(snappedY / 90) % 4) + 4) % 4;
  } else if (intent && intent.face === "Down") {
    surface = "ceiling";
    d = ((Math.round(snappedY / 90) % 4) + 4) % 4;
  } else if (intent) {
    const fromFace = FACE_TO_D[String(intent.face)];
    d = typeof fromFace === "number" ? fromFace : 0;
  }
  const dir = DIRS[d];
  const eventName = "set_oriented_" + surface + "_" + dir;
  if (!e.isValid) return;
  // One painting per spot: refuse the placement if an oriented painting
  // already sits in the same block on the same surface (same wall side, or
  // floor / ceiling of that block). Paintings on different sides of the same
  // block (e.g. two walls of a corner) are still allowed.
  if (isSpotTaken(e, surface, d)) {
    e.remove();
    const player = intent ? world.getAllPlayers().find((p) => p.id === intent.playerId) : null;
    if (player) refundPlacerItem(player, e.typeId);
    dbg("placement refused: spot taken", { surface, dir });
    return;
  }
  // custom_hit_test is sent to clients only with the entity's initial spawn
  // data: a component group added after the spawn changes the server-side
  // state but the client - which decides what the player's swing hits -
  // never sees the new hitboxes (verified in-game). So instead of
  // triggering the event on the placer-spawned entity, spawn a replacement
  // with the orientation event applied AT spawn, and drop the original.
  try {
    const copy = e.dimension.spawnEntity(e.typeId, e.location, { initialRotation: 0, spawnEvent: eventName });
    replacements.add(copy.id);
    e.remove();
    dbg("respawned with " + eventName, { surface, dir, face: intent ? String(intent.face) : null });
  } catch (err) {
    // Older API without spawn options: orient in place (hitbox will only
    // reach clients after the entity is re-sent, e.g. on chunk reload).
    if (!e.isValid) return;
    e.triggerEvent(eventName);
    dbg("respawn failed, triggered " + eventName + " in place", { error: String(err) });
  }
});

// Breaking. The entity never takes damage (damage_sensor deals_damage "no"),
// so the hit is resolved here from the attacker's game mode: Creative always
// removes the painting without drops; Survival / Adventure break it and drop
// its placer item only when the pack allows it, otherwise nothing happens.
safeSubscribe("entityHitEntity", world.afterEvents && world.afterEvents.entityHitEntity, (event) => {
  const e = event.hitEntity;
  const player = event.damagingEntity;
  if (!e?.isValid || !player || player.typeId !== "minecraft:player") return;
  if (!e.matches({ families: [FAMILY] })) return;
  let mode = "";
  try { mode = String(player.getGameMode()).toLowerCase(); } catch {}
  const drop = (mode === "survival" && BREAK_IN_SURVIVAL) || (mode === "adventure" && BREAK_IN_ADVENTURE);
  dbg("painting hit", { typeId: e.typeId, mode, drop });
  if (mode !== "creative" && !drop) return;
  if (drop) {
    try {
      e.dimension.spawnItem(new ItemStack(e.typeId + ITEM_SUFFIX, 1), e.location);
    } catch (err) {
      dbg("drop failed", { error: String(err) });
    }
  }
  e.remove();
});
`;
}

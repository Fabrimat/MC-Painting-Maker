export function buildMainJs(
  namespace: string,
  opts: { debug?: boolean; buildSha?: string; buildDate?: string } = {},
): string {
  const debug = !!opts.debug;
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
import { world } from "@minecraft/server";

const FAMILY = "${namespace}_painting";
const ITEM_NS = "${namespace}:";
const ITEM_SUFFIX = "_painting";
const INTENT_WINDOW_MS = 500;

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
// the spawned entity. Track the block face per player at interaction time
// and consume it on the matching entitySpawn (same tick).
const intents = new Map();

function isPlacerItem(typeId) {
  return typeof typeId === "string"
    && typeId.startsWith(ITEM_NS)
    && typeId.endsWith(ITEM_SUFFIX);
}

function storeIntent(playerId, blockFace, via) {
  intents.set(playerId, { face: blockFace, t: Date.now() });
  dbg("intent stored", { playerId, face: String(blockFace), via, size: intents.size });
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

function takeIntentFor(entity) {
  if (intents.size === 0) return null;
  const now = Date.now();
  const pos = entity.location;
  const players = world.getAllPlayers();
  let bestKey = null;
  let bestVal = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [id, value] of intents) {
    if (now - value.t > INTENT_WINDOW_MS) {
      intents.delete(id);
      continue;
    }
    const player = players.find((p) => p.id === id);
    const dist = player
      ? (player.location.x - pos.x) ** 2 + (player.location.y - pos.y) ** 2 + (player.location.z - pos.z) ** 2
      : Number.POSITIVE_INFINITY;
    // Use <= so an intent whose player has gone (dist=Infinity) still wins
    // when it is the only candidate, instead of being silently dropped.
    if (bestKey === null || dist < bestDist) {
      bestDist = dist;
      bestKey = id;
      bestVal = value;
    }
  }
  if (bestKey !== null) intents.delete(bestKey);
  return bestVal;
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
  const r = e.getRotation();
  const snappedY = Math.round(r.y / 90) * 90;
  const intent = takeIntentFor(e);
  dbg("painting spawned", {
    typeId: e.typeId,
    cause: String(event.cause),
    rawRotation: { x: r.x, y: r.y },
    intent: intent ? { face: String(intent.face), ageMs: Date.now() - intent.t } : null,
    intentsLeft: intents.size,
  });
  // Yaw only: Bedrock does not propagate entity pitch to the rendered model
  // for inanimate entities, so we drive the floor/ceiling rotation via a
  // client-side animation that reads mark_variant instead of via setRotation.
  if (!e.isValid) return;
  e.setRotation({ x: 0, y: snappedY });
  dbg("setRotation", { x: 0, y: snappedY });
  // The entity has NO hitbox until one of the orientation component groups
  // is added (see entity.ts). 4 cardinal directions x 3 surface verses = 12
  // groups total. The wall direction comes straight from the clicked block
  // face; for floor/ceiling we derive it from the entity's yaw (snapped to
  // a cardinal). Without an intent (e.g. /summon) we default to wall_north.
  const DIRS = ["north", "east", "south", "west"];
  const FACE_TO_INDEX = { North: 0, East: 1, South: 2, West: 3 };
  let surface = "wall";
  let dirIndex = 0;
  if (intent && intent.face === "Up") {
    surface = "floor";
    dirIndex = ((Math.round(snappedY / 90) % 4) + 4) % 4;
  } else if (intent && intent.face === "Down") {
    surface = "ceiling";
    dirIndex = ((Math.round(snappedY / 90) % 4) + 4) % 4;
  } else if (intent) {
    surface = "wall";
    const fromFace = FACE_TO_INDEX[String(intent.face)];
    dirIndex = typeof fromFace === "number" ? fromFace : 0;
  }
  const dir = DIRS[dirIndex];
  const eventName = "set_oriented_" + surface + "_" + dir;
  if (!e.isValid) return;
  e.triggerEvent(eventName);
  dbg("triggered " + eventName, { surface, dir, face: intent ? String(intent.face) : null });
});
`;
}

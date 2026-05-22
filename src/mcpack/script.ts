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

// Two parallel sources of intent for diagnostics: itemUseOn is the direct
// hook for entity_placer activation, playerInteractWithBlock is the generic
// interaction event. We accept whichever fires first; in practice they fire
// on the same tick, so the second store_intent is a harmless overwrite.
world.afterEvents.itemUseOn.subscribe((event) => {
  const stack = event.itemStack;
  if (!stack) return;
  const matched = isPlacerItem(stack.typeId);
  dbg("itemUseOn", { item: stack.typeId, matched, face: String(event.blockFace), player: event.source && event.source.name });
  if (!matched || !event.source) return;
  storeIntent(event.source.id, event.blockFace, "itemUseOn");
});

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const stack = event.itemStack;
  if (!stack) return;
  const matched = isPlacerItem(stack.typeId);
  dbg("playerInteractWithBlock", { item: stack.typeId, matched, face: String(event.blockFace), player: event.player.name });
  if (!matched) return;
  storeIntent(event.player.id, event.blockFace, "interactWithBlock");
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

world.afterEvents.entitySpawn.subscribe((event) => {
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
  // Block face -> entity pitch:
  //   Up   (floor)   -> +90
  //   Down (ceiling) -> -90
  //   else (wall)    ->   0
  let snappedX = 0;
  if (intent && intent.face === "Up") snappedX = 90;
  else if (intent && intent.face === "Down") snappedX = -90;
  if (!e.isValid) return;
  e.setRotation({ x: snappedX, y: snappedY });
  dbg("setRotation", { x: snappedX, y: snappedY });
  if (Math.abs(snappedX) === 90) {
    if (!e.isValid) return;
    e.triggerEvent("set_flat_orient");
    dbg("triggered set_flat_orient");
  }
});
`;
}

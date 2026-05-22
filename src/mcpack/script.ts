export function buildMainJs(namespace: string, opts: { debug?: boolean } = {}): string {
  const debug = !!opts.debug;
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

  return `import { world } from "@minecraft/server";

const FAMILY = "${namespace}_painting";
const ITEM_NS = "${namespace}:";
const ITEM_SUFFIX = "_painting";
const INTENT_WINDOW_MS = 200;

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

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const stack = event.itemStack;
  if (!stack) {
    dbg("interact ignored (no itemStack)");
    return;
  }
  const matched = isPlacerItem(stack.typeId);
  dbg("interact", { item: stack.typeId, matched, face: String(event.blockFace), player: event.player.name });
  if (!matched) return;
  intents.set(event.player.id, { face: event.blockFace, t: Date.now() });
  dbg("intent stored", { playerId: event.player.id, face: String(event.blockFace), size: intents.size });
});

function takeIntentFor(entity) {
  if (intents.size === 0) return null;
  const now = Date.now();
  const pos = entity.location;
  const players = world.getAllPlayers();
  let bestKey = null;
  let bestVal = null;
  let bestDist = Infinity;
  for (const [id, value] of intents) {
    if (now - value.t > INTENT_WINDOW_MS) {
      intents.delete(id);
      continue;
    }
    const player = players.find((p) => p.id === id);
    const dist = player
      ? (player.location.x - pos.x) ** 2 + (player.location.y - pos.y) ** 2 + (player.location.z - pos.z) ** 2
      : Number.POSITIVE_INFINITY;
    if (dist < bestDist) {
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
  if (!e?.isValid) {
    dbg("spawn ignored (invalid entity)");
    return;
  }
  const matchesFamily = e.matches({ families: [FAMILY] });
  dbg("entitySpawn", { typeId: e.typeId, matchesFamily, cause: String(event.cause) });
  if (!matchesFamily) return;
  if (!e.isValid) return;
  const r = e.getRotation();
  const snappedY = Math.round(r.y / 90) * 90;
  const intent = takeIntentFor(e);
  dbg("intent lookup", {
    found: intent !== null,
    face: intent ? String(intent.face) : null,
    rawRotation: { x: r.x, y: r.y },
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

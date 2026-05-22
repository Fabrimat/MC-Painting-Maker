export function buildMainJs(namespace: string): string {
  return `import { world } from "@minecraft/server";

const FAMILY = "${namespace}_painting";
const ITEM_NS = "${namespace}:";
const ITEM_SUFFIX = "_painting";
const INTENT_WINDOW_MS = 200;

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
  if (!stack || !isPlacerItem(stack.typeId)) return;
  intents.set(event.player.id, { face: event.blockFace, t: Date.now() });
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
  if (!e?.isValid) return;
  if (!e.matches({ families: [FAMILY] })) return;
  if (!e.isValid) return;
  const r = e.getRotation();
  const snappedY = Math.round(r.y / 90) * 90;
  const intent = takeIntentFor(e);
  // Block face -> entity pitch:
  //   Up   (floor)   -> +90
  //   Down (ceiling) -> -90
  //   else (wall)    ->   0
  let snappedX = 0;
  if (intent && intent.face === "Up") snappedX = 90;
  else if (intent && intent.face === "Down") snappedX = -90;
  if (!e.isValid) return;
  e.setRotation({ x: snappedX, y: snappedY });
  if (Math.abs(snappedX) === 90) {
    if (!e.isValid) return;
    e.triggerEvent("set_flat_orient");
  }
});
`;
}

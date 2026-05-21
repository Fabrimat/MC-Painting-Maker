export function buildMainJs(namespace: string): string {
  return `import { world } from "@minecraft/server";

const FAMILY = "${namespace}_painting";

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
  // Pitch snap: -90 (ceiling), 0 (wall), +90 (floor). The placer propagates
  // the player's pitch to the entity at spawn, so we just round and clamp.
  const snappedX = Math.max(-90, Math.min(90, Math.round(r.x / 90) * 90));
  if (!e.isValid) return;
  e.setRotation({ x: snappedX, y: snappedY });
  if (Math.abs(snappedX) === 90) {
    if (!e.isValid) return;
    e.triggerEvent("set_flat_orient");
  }
});
`;
}

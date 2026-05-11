export function buildMainJs(namespace: string): string {
  return `import { world } from "@minecraft/server";

const FAMILY = "${namespace}_painting";

world.afterEvents.entitySpawn.subscribe((event) => {
  const e = event.entity;
  if (!e.matches({ families: [FAMILY] })) return;
  const r = e.getRotation();
  const snappedY = Math.round(r.y / 90) * 90;
  e.setRotation({ x: 0, y: snappedY });
});
`;
}

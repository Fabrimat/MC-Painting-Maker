// Identifier helpers for a single painting. They consume the painting's stable
// `slug` (generated once at creation, see paintings/slug.ts) so that file names,
// entity IDs and resource keys all match and stay constant across renames.

type WithSlug = { slug: string };

export function sanitizeId(uuid: string): string {
  return uuid.toLowerCase().replace(/-/g, '_');
}

export function paintingFileBase(p: WithSlug): string {
  return p.slug;
}

export function entityId(namespace: string, p: WithSlug): string {
  return `${namespace}:${p.slug}`;
}

export function spawnEggItemId(namespace: string, p: WithSlug): string {
  return `${entityId(namespace, p)}_spawn_egg`;
}

export function spawnEggTextureKey(p: WithSlug): string {
  return `${p.slug}_egg`;
}

export function geometryName(p: WithSlug): string {
  return `geometry.${p.slug}`;
}

export function renderControllerName(p: WithSlug): string {
  return `controller.render.${p.slug}`;
}

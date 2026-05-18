// Identifier helpers for a single painting. They consume the painting's current
// `slug` so that file names, entity IDs and resource keys all match. When the
// painting is unlocked (see paintings/slug.ts), the slug follows renames and
// these identifiers change accordingly.

type WithSlug = { slug: string };

export function sanitizeId(uuid: string): string {
  return uuid.toLowerCase().replace(/-/g, '_');
}

export function paintingFileBase(p: WithSlug): string {
  return p.slug;
}

// Slug with the trailing `_<uuid8>` disambiguator stripped. Used as a clean,
// human-readable suffix in lang keys so the .lang file stays UUID-free.
// Paintings whose names normalize identically share one lang line - the lang
// VALUE is also the same for matching names, so the collapse is harmless.
const UUID8_SUFFIX = /_[0-9a-f]{8}$/;
export function paintingNameSlug(p: WithSlug): string {
  return p.slug.replace(UUID8_SUFFIX, '');
}

export function entityId(namespace: string, p: WithSlug): string {
  return `${namespace}:${p.slug}`;
}

// Custom placer item id. Kept distinct from the entity id (which is `ns:slug`)
// so /give and /summon stay unambiguous and Bedrock has separate registry keys.
export function paintingItemId(namespace: string, p: WithSlug): string {
  return `${entityId(namespace, p)}_painting`;
}

export function paintingIconTextureKey(p: WithSlug): string {
  return `${p.slug}_icon`;
}

export function geometryName(p: WithSlug): string {
  return `geometry.${p.slug}`;
}

export function renderControllerName(p: WithSlug): string {
  return `controller.render.${p.slug}`;
}

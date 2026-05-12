import type { Painting } from './types';
import { generatePaintingSlug, CURRENT_SLUG_VERSION } from './slug';

// Centralized patcher for Painting state. Applies the patch, then reconciles the
// derived slug: when the result is unlocked AND the patch touched `name` or
// flipped `slugLocked` to false, the slug is rederived from the (post-patch)
// name and stamped with the current generation algorithm version. Explicit
// `slug` values in the patch win over rederivation only when the result is
// locked (i.e. user typed a slug, which always co-arrives with slugLocked: true).
export function applyPaintingPatch(p: Painting, patch: Partial<Painting>): Painting {
  const next: Painting = { ...p, ...patch };
  const nameChanged = patch.name !== undefined;
  const justUnlocked = patch.slugLocked === false;
  if (!next.slugLocked && (nameChanged || justUnlocked)) {
    next.slug = generatePaintingSlug(next.name, next.id);
    next.slugVersion = CURRENT_SLUG_VERSION;
  }
  return next;
}

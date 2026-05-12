// Internal slug derived from a painting's display name + UUID.
// Format: <sanitized_name>_<uuid8>, e.g. "sunset_a3f8b1c2".
// Re-derived on rename when the painting is unlocked; frozen when locked.
// The UUID suffix guarantees uniqueness across paintings that share a name.

// Bump when the slug-generation algorithm changes. New paintings get the bumped
// version; existing slugs stay frozen at the version they were generated under.
// History:
//   1 - initial: NFKD + strip diacritics, lowercase, non-alphanumerics -> _,
//       trim, cap 20 chars, p_ prefix for empty or digit-leading names.
export const CURRENT_SLUG_VERSION = 1;

const NAME_MAX = 20;
// Combining diacritical marks block (U+0300..U+036F): stripped after NFKD
// normalisation so that accented letters reduce to their base letters.
const COMBINING_MARKS = /[̀-ͯ]/g;

export function generatePaintingSlug(name: string, uuid: string): string {
  const cleaned = sanitizeNamePart(name);
  const uuid8 = uuid.replace(/-/g, '').slice(0, 8).toLowerCase();
  if (!cleaned) return `p_${uuid8}`;
  // Bedrock identifiers should start with a letter; prefix names that don't.
  if (/^[0-9]/.test(cleaned)) return `p_${cleaned}_${uuid8}`;
  return `${cleaned}_${uuid8}`;
}

function sanitizeNamePart(name: string): string {
  return name
    .normalize('NFKD').replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, NAME_MAX)
    .replace(/_+$/, '');
}

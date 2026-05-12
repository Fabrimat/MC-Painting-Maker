# In-game ID with lock + auto-follow Design

**Status:** Approved 2026-05-12
**Owner:** Fabrizio La Rosa

## Goal

The painting properties panel shows the painting's in-game entity ID (`<namespace>:<slug>`) and lets the user copy it. The slug part is editable. A lock toggle controls whether the slug auto-derives from the painting's display name. Until now the slug has been frozen at creation; this change makes auto-follow the new default for new paintings while preserving existing slugs on load.

## Motivation

The slug is the identifier baked into the exported addon's entity definition, file names, geometry name, render-controller name, spawn-egg item, and texture key. Users need to see it because they reference it in commands (e.g. `/summon paintings:sunset_a3f8b1c2`).

Today the slug is generated once at painting creation and never changes. That is safe for export stability but counter-intuitive: a user who renames "Sunset" to "Mountain" still sees `sunset_a3f8b1c2` in their addon. They have no UI affordance to fix this. The lock model gives auto-follow by default while letting users opt into a stable custom value when needed.

## Non-goals

- No display of the spawn-egg item ID (`namespace:slug_spawn_egg`). Out of scope.
- No editing the namespace from this panel. Namespace stays in `PackDrawer`.
- No bulk lock-state operations across multiple paintings.
- No change to slug generation algorithm or `slugVersion` semantics for currently-locked slugs.

## Lock-state semantics

A new boolean field `slugLocked` is added to `Painting`. It controls slug behavior:

- **Unlocked** (`slugLocked === false`): the slug is treated as derived. Any change to `name` immediately recomputes `slug = generatePaintingSlug(name, id)`.
- **Locked** (`slugLocked === true`): the slug is treated as user-owned. Renaming the painting does NOT touch the slug.

Two user interactions also flip the lock:

- **Editing the slug input directly** (any change to its value): force `slugLocked = true` together with persisting the new value.
- **Toggling lock from locked → unlocked**: in a single update, set `slugLocked = false` AND set `slug = generatePaintingSlug(name, id)`. The stale custom value is discarded by design - unlocking means "follow the name from now on".
- **Toggling lock from unlocked → locked**: flag-only. The current (derived) slug stays as-is and becomes the user-owned value going forward.

## Default values

- **New paintings** (via `createPaintingFromImage`): `slugLocked: false`. The slug is still seeded at creation (so it's a non-empty string the first time it's rendered), but it auto-follows the name afterwards.
- **Migration** for projects saved before this change (no `slugLocked` field): `slugLocked: true`. Every existing slug is preserved verbatim regardless of name. Users can manually unlock paintings whose slugs they want to re-derive.

Migration runs in `migrate()` alongside the existing slug backfill. The migrated value is persisted on next save like any other field.

## UI

A new section is appended to `src/ui/PaintingProperties.svelte`, after the Transparency section:

```
In-game ID
paintings: [sunset_a3f8b1c2      ] [🔓] [Copy]
Auto-updates with the painting name. Lock to keep the current value when renaming.
```

Locked variant:

```
paintings: [my_custom_slug       ] [🔒] [Copy]
Custom value. Click 🔒 to resume auto-update from the painting name.
```

Layout details:

- **Namespace prefix:** static span reading `$project.pack.namespace + ':'`. Not editable here. Updates reactively when the user changes the namespace in `PackDrawer`.
- **Slug input:** `<input class="field">`. Editable in both lock states.
- **Lock button:** icon button. `aria-pressed` reflects lock state. Click toggles. SVG glyphs or a unicode pair (🔒 / 🔓); final glyph choice is a styling detail handled at implementation time.
- **Copy button:** click copies the full `namespace:slug` via `navigator.clipboard.writeText`. Fallback for unavailable clipboard API: select the input text so the user can press Ctrl+C. Brief "Copied!" state for ~1.5s after success.
- **Hint paragraph:** the text below the row swaps between the two variants above depending on `slugLocked`.

## Validation

Applied to the slug input (the namespace is validated separately in `PackDrawer`):

- **Pattern:** `/^[a-z][a-z0-9_]*$/`. Lowercase letter first, then lowercase alphanumerics and underscore. Same shape as the namespace rule, adjusted for length.
- **Length:** 1 to 32 characters inclusive.
- **Uniqueness:** the slug must differ from every other painting's slug in the same project.

Validation behavior:

- During typing: error message shown inline below the input in red (`.err` class, reusing the `PackDrawer` style). The store is not updated while invalid.
- On `blur`: if still invalid, the input reverts to the last valid value and the error clears. If valid, the new value is persisted and `slugLocked` is set to `true`.
- Lock-toggle interactions are exempt from validation: rederiving from name always produces a valid slug by construction.

## Where the auto-update logic lives

A new helper centralizes the reconciliation so callers do not duplicate logic:

```ts
// src/paintings/painting.ts
export function applyPaintingPatch(p: Painting, patch: Partial<Painting>): Painting {
  const next = { ...p, ...patch };
  if (!next.slugLocked && (patch.name !== undefined || patch.slugLocked === false)) {
    next.slug = generatePaintingSlug(next.name, next.id);
    next.slugVersion = CURRENT_SLUG_VERSION;
  }
  return next;
}
```

Call sites:

- `src/ui/EditorHeader.svelte` (the painting-rename input) uses `applyPaintingPatch` when committing a new name.
- `src/ui/PaintingProperties.svelte` uses `applyPaintingPatch` for slug edits, lock toggles, and the existing per-field patches. Existing patch invocations for canvas/density/material/resampling are unaffected (no `name` or `slugLocked` change → behaves like a plain spread).

The helper is the single source of truth for "what does this painting look like after this patch?". Direct `{ ...p, ...patch }` spreads in components that touch `name` or `slugLocked` should be migrated to use it.

## File touchpoints

| File | Change |
|---|---|
| `src/paintings/types.ts` | Add `slugLocked: boolean` to `Painting`. Update the slug comment to reflect the new semantics. |
| `src/paintings/schema.ts` | Add `slugLocked: z.boolean()` to the painting sub-schema. |
| `src/paintings/defaults.ts` | New paintings get `slugLocked: false`. Migration in `migrate()` defaults missing `slugLocked` to `true`. |
| `src/paintings/slug.ts` | Update header comment: slugs are no longer guaranteed frozen. |
| `src/paintings/painting.ts` (new) | Helper `applyPaintingPatch` per above. |
| `src/paintings/painting.test.ts` (new) | Unit tests for the helper (see Test strategy). |
| `src/ui/EditorHeader.svelte` | Use `applyPaintingPatch` for rename commits. |
| `src/ui/PaintingProperties.svelte` | New section, namespace prefix, slug input + validation, lock button, copy button, hint. Convert existing patches to use `applyPaintingPatch`. |
| `src/ui/PaintingProperties.test.ts` | Cover the new section, validation, lock toggle, copy, auto-follow on rename. |
| `src/paintings/schema.test.ts` | Cover migration: legacy projects get `slugLocked: true`; new schema rejects payloads missing the field. |
| `src/paintings/defaults.test.ts` (if present) | Cover `createPaintingFromImage` returning `slugLocked: false`. |

The identifier helpers in `src/mcpack/identifiers.ts` (`entityId`, `paintingFileBase`, `geometryName`, `renderControllerName`, `spawnEggItemId`, `spawnEggTextureKey`) need no code change but their comments referencing "constant across renames" should be updated to reflect the new behavior.

## Edge cases

- **Empty name on rename:** `applyPaintingPatch` is only called with a non-empty name (existing UI rejects blanks). If somehow called with empty, `generatePaintingSlug('', id)` returns `p_<uuid8>`, still valid.
- **Two paintings with the same name, both unlocked:** their slugs differ because the helper appends the per-painting `uuid8` suffix. No collision possible by construction in this path.
- **Manual slug collision:** user types a slug that matches another painting's. Validation rejects with "This ID is already used by another painting." Revert on blur.
- **Toggle lock→unlock while name produced an empty derived slug:** generation fallback kicks in (`p_<uuid8>`), still a valid value.
- **Old project with a slug that does not match `^[a-z][a-z0-9_]*$/`:** migration accepts whatever was there (schema's slug rule already required the same shape; if anything slipped through historically, it surfaces here as a validation error on the project load, not on this feature). Out of scope to retroactively repair.
- **Namespace becomes invalid in `PackDrawer`:** the namespace prefix in this section still renders the current (invalid) value; the user sees the error in the PackDrawer that owns namespace editing. Not duplicated here.
- **Clipboard API unavailable:** Copy button falls back to `input.select()` so the user can press Ctrl+C. No error toast.

## Test strategy

Unit tests in three layers:

1. **`applyPaintingPatch` (paintings/painting.test.ts):**
   - Unlocked + name change → slug recomputes and matches `generatePaintingSlug(newName, id)`.
   - Locked + name change → slug stays unchanged.
   - Locked + slug change → slug updates, slugLocked stays true.
   - Unlocked + lock toggle to false (still unlocked, but explicit) → slug recomputes from current name.
   - Lock toggle locked → unlocked → slug rederived; toggle unlocked → locked → slug unchanged.

2. **Schema migration (paintings/schema.test.ts):**
   - Legacy project (no `slugLocked` field) loads with `slugLocked: true` on every painting.
   - New project with `slugLocked` field round-trips through parse unchanged.
   - `defaults.test.ts`: `createPaintingFromImage` returns `slugLocked: false`.

3. **UI behavior (ui/PaintingProperties.test.ts):**
   - Renders the "In-game ID" section showing `paintings:<slug>`.
   - Slug input is editable; typing a valid slug + blur sets `slug` and `slugLocked: true` in the store.
   - Typing an invalid slug shows error, blur reverts to previous value.
   - Typing a slug that collides with another painting shows error.
   - Lock button toggles `slugLocked`. Locked → unlocked also rederivates from name.
   - Copy button calls `navigator.clipboard.writeText` with `namespace:slug` (mock the API).
   - Changing `pack.namespace` in the store updates the displayed prefix reactively.
   - When unlocked, renaming the painting (via `EditorHeader`) updates the slug shown in the panel. (Tested by separately patching the store and re-rendering, since the rename UI is in another component.)

Manual verification:

1. Create a new painting, rename it: the In-game ID auto-updates.
2. Lock, then rename: the In-game ID stays the same.
3. Unlock: the In-game ID jumps back to the derived value.
4. Edit the slug directly: the lock icon switches to locked automatically.
5. Open a project saved before this change: every painting is locked; slugs are unchanged.
6. Copy: paste in a terminal or Minecraft chat, get `namespace:slug`.

## Open questions

None.

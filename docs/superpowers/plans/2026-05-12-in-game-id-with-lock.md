# In-game ID with Lock + Auto-follow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the in-game entity ID in the property panel with a lock toggle that controls whether the slug auto-derives from the painting name.

**Architecture:** A new `slugLocked: boolean` field on `Painting` (default `false` for new paintings, `true` on migration of legacy projects). A small helper `applyPaintingPatch` centralizes name/lock reconciliation. The property panel grows an "In-game ID" section with a namespace prefix, editable slug input, lock button, and copy button. The rename input in `EditorHeader` goes through the helper so the slug follows the name when unlocked.

**Tech Stack:** TypeScript, Svelte 5, Vitest, `@testing-library/svelte`, Zod.

---

### Task 1: Add `slugLocked` field to types, schema, defaults, and migration

**Files:**
- Modify: `src/paintings/types.ts`
- Modify: `src/paintings/schema.ts`
- Modify: `src/paintings/defaults.ts`
- Modify: `src/paintings/slug.ts` (comment update only)
- Test: `src/paintings/defaults.test.ts`
- Test: `src/paintings/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `src/paintings/defaults.test.ts`. Append two new tests inside the existing `describe('createPaintingFromImage', ...)` block (before the closing brace):

```typescript
  it('starts unlocked so the slug follows the painting name by default', () => {
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    expect(p.slugLocked).toBe(false);
  });
```

Append two new tests inside the existing `describe('migrate', ...)` block (before the closing brace):

```typescript
  it('defaults slugLocked to true when missing (preserves existing slugs)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const raw = JSON.parse(JSON.stringify(proj)) as {
      paintings: Array<{ slugLocked?: boolean }>;
    };
    delete raw.paintings[0].slugLocked;
    const migrated = migrate(raw);
    expect(migrated.paintings[0].slugLocked).toBe(true);
  });

  it('preserves an explicit slugLocked through migration', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const raw = JSON.parse(JSON.stringify(proj)) as {
      paintings: Array<{ slugLocked: boolean }>;
    };
    raw.paintings[0].slugLocked = false;
    const migrated = migrate(raw);
    expect(migrated.paintings[0].slugLocked).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/paintings/defaults.test.ts`

Expected: the three new tests fail because `slugLocked` is not yet on the schema or defaults.

- [ ] **Step 3: Add the field to the `Painting` type**

Edit `src/paintings/types.ts`. Find the comment block above `slug:` (lines 43-46) and the `slugVersion` declaration (lines 49-50). Replace the existing slug comment with one that reflects the new lock model, and add `slugLocked` immediately after `slugVersion`.

Old:
```typescript
  // Stable internal slug, derived once from name+id at creation. Used for entity
  // identifiers, file names, geometry/render controller names. Renaming the
  // painting's display name does NOT change the slug.
  slug: string;
  // Version of the slug-generation algorithm that produced `slug`. Frozen with
  // the slug; future algorithm bumps only affect newly-created paintings.
  slugVersion: number;
```

New:
```typescript
  // Internal slug used for entity identifiers, file names, geometry/render
  // controller names. When `slugLocked` is false the slug auto-derives from
  // `name`+`id`; when true it is user-owned and survives renames.
  slug: string;
  // Version of the slug-generation algorithm that produced `slug`. Stamped with
  // `CURRENT_SLUG_VERSION` whenever the slug is (re)derived.
  slugVersion: number;
  // Lock state controlling whether `slug` follows `name`. See applyPaintingPatch.
  slugLocked: boolean;
```

- [ ] **Step 4: Add the field to the Zod schema**

Edit `src/paintings/schema.ts` lines 51-67 (the `PaintingSchema` definition). Add `slugLocked` after `slugVersion`:

```typescript
export const PaintingSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string().min(1),
  slugVersion: z.number().int().positive(),
  slugLocked: z.boolean(),
  canvasW16: z.number().int().positive(),
  canvasH16: z.number().int().positive(),
  source: SourceSchema.nullable(),
  transform: TransformSchema,
  resampling: z.union([z.literal('smooth'), z.literal('pixelated')]),
  textureDensity: z.union([
    z.literal('auto'),
    z.literal(1), z.literal(2), z.literal(4), z.literal(8),
    z.literal(16), z.literal(32), z.literal(64),
  ]),
  material: z.union([z.literal('alphatest'), z.literal('alphablend')]),
});
```

- [ ] **Step 5: Default new paintings to unlocked**

Edit `src/paintings/defaults.ts`. In `createPaintingFromImage` (lines 61-73), add `slugLocked: false` to the returned object, immediately after `slugVersion`:

```typescript
  return {
    id,
    name,
    slug: generatePaintingSlug(name, id),
    slugVersion: CURRENT_SLUG_VERSION,
    slugLocked: false,
    canvasW16: w16,
    canvasH16: h16,
    source,
    transform: { x16: 0, y16: 0, w16, h16, rotation: 0, flipX: false, flipY: false },
    resampling: 'smooth',
    textureDensity: 'auto',
    material: 'alphatest',
  };
```

- [ ] **Step 6: Backfill `slugLocked` in `migrate()`**

Edit `src/paintings/defaults.ts`. Update the `migrate` function (lines 76-103). Extend the raw-paintings interface to include `slugLocked` and add a backfill branch alongside the existing ones:

```typescript
export function migrate(state: unknown): ProjectState {
  if (typeof state !== 'object' || state === null || !('version' in state)) {
    throw new Error('Invalid project state: missing version');
  }
  const v = (state as { version: unknown }).version;
  if (v !== 1) throw new Error(`Unsupported project version: ${String(v)}`);
  // Slug + slugVersion were added after the first wave of projects. Backfill from
  // the current name + id before validation. Once set, both fields are frozen, so
  // this only runs on the migration boundary. Paintings without slugVersion are
  // assumed v1 because that was the only algorithm before the field existed.
  // slugLocked defaults to true for legacy paintings so their existing slug is
  // preserved verbatim. New paintings created today default to false.
  const raw = state as { paintings?: Array<{
    id?: unknown; name?: unknown; slug?: unknown;
    slugVersion?: unknown; slugLocked?: unknown;
  }> };
  if (Array.isArray(raw.paintings)) {
    for (const p of raw.paintings) {
      if (!p || typeof p !== 'object') continue;
      if (typeof p.slug !== 'string' || !p.slug) {
        const id = typeof p.id === 'string' ? p.id : '';
        const name = typeof p.name === 'string' ? p.name : '';
        p.slug = generatePaintingSlug(name, id);
      }
      if (typeof p.slugVersion !== 'number' || !Number.isInteger(p.slugVersion) || p.slugVersion < 1) {
        p.slugVersion = 1;
      }
      if (typeof p.slugLocked !== 'boolean') {
        p.slugLocked = true;
      }
    }
  }
  return ProjectSchema.parse(state);
}
```

- [ ] **Step 7: Update the comment in `slug.ts`**

Edit `src/paintings/slug.ts` lines 1-4. Replace:

```typescript
// Stable internal slug derived from a painting's display name + UUID.
// Format: <sanitized_name>_<uuid8>, e.g. "sunset_a3f8b1c2".
// Generated once at painting creation, persisted on the painting, and never changed.
// The UUID suffix guarantees uniqueness across paintings that share a name.
```

With:

```typescript
// Internal slug derived from a painting's display name + UUID.
// Format: <sanitized_name>_<uuid8>, e.g. "sunset_a3f8b1c2".
// Re-derived on rename when the painting is unlocked; frozen when locked.
// The UUID suffix guarantees uniqueness across paintings that share a name.
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/paintings/defaults.test.ts src/paintings/schema.test.ts`

Expected: all tests pass, including the three new ones. (Existing migration tests that preserve slugs on rename still pass: legacy data gets `slugLocked: true` so the slug stays put.)

- [ ] **Step 9: Update the two known `Painting` fixtures in tests**

Two test files construct a `Painting` literal manually and will fail TypeScript with the new required field. Add `slugLocked: false` to each.

Edit `src/editor/previewRaster.test.ts` line 15. Replace:
```typescript
    id: 'p', name: 'p', slug: 'p', slugVersion: 1,
```
With:
```typescript
    id: 'p', name: 'p', slug: 'p', slugVersion: 1, slugLocked: false,
```

Edit `src/paintings/density.test.ts` line 7. Replace:
```typescript
    id: 'p', name: 'p', slug: 'p', slugVersion: 1,
```
With:
```typescript
    id: 'p', name: 'p', slug: 'p', slugVersion: 1, slugLocked: false,
```

`src/mcpack/identifiers.test.ts` uses a `WithSlug` minimal type (just `{ slug }`), not a full `Painting` literal - no change needed there.

- [ ] **Step 10: Update the comment in `identifiers.ts`**

Edit `src/mcpack/identifiers.ts` lines 1-3. Replace:

```typescript
// Identifier helpers for a single painting. They consume the painting's stable
// `slug` (generated once at creation, see paintings/slug.ts) so that file names,
// entity IDs and resource keys all match and stay constant across renames.
```

With:

```typescript
// Identifier helpers for a single painting. They consume the painting's current
// `slug` so that file names, entity IDs and resource keys all match. When the
// painting is unlocked (see paintings/slug.ts), the slug follows renames and
// these identifiers change accordingly.
```

- [ ] **Step 11: Run the full suite + type-check**

Run: `npm test`

Expected: all tests pass.

Run: `npm run check`

Expected: no type errors.

- [ ] **Step 12: Commit**

```bash
git add src/paintings/types.ts src/paintings/schema.ts src/paintings/defaults.ts src/paintings/slug.ts src/paintings/defaults.test.ts src/editor/previewRaster.test.ts src/paintings/density.test.ts src/mcpack/identifiers.ts
git commit -m "feat(paintings): add slugLocked field with migration default"
```

---

### Task 2: Create `applyPaintingPatch` helper

**Files:**
- Create: `src/paintings/painting.ts`
- Create: `src/paintings/painting.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/paintings/painting.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { applyPaintingPatch } from './painting';
import { createPaintingFromImage } from './defaults';
import { generatePaintingSlug, CURRENT_SLUG_VERSION } from './slug';
import type { Painting } from './types';

function fresh(name: string): Painting {
  return createPaintingFromImage(name, { pngBase64: '', naturalW: 32, naturalH: 32 });
}

describe('applyPaintingPatch', () => {
  it('rederivates slug from new name when unlocked', () => {
    const p = fresh('Sunset');
    expect(p.slugLocked).toBe(false);
    const next = applyPaintingPatch(p, { name: 'Mountain' });
    expect(next.name).toBe('Mountain');
    expect(next.slug).toBe(generatePaintingSlug('Mountain', p.id));
    expect(next.slugVersion).toBe(CURRENT_SLUG_VERSION);
  });

  it('preserves slug on rename when locked', () => {
    const p = { ...fresh('Sunset'), slugLocked: true };
    const before = p.slug;
    const next = applyPaintingPatch(p, { name: 'Mountain' });
    expect(next.name).toBe('Mountain');
    expect(next.slug).toBe(before);
    expect(next.slugLocked).toBe(true);
  });

  it('applies an explicit slug change verbatim regardless of lock state', () => {
    const p = fresh('Sunset');
    const next = applyPaintingPatch(p, { slug: 'custom_value', slugLocked: true });
    expect(next.slug).toBe('custom_value');
    expect(next.slugLocked).toBe(true);
  });

  it('rederivates slug when toggling locked to unlocked', () => {
    const p = { ...fresh('Sunset'), name: 'Mountain', slug: 'frozen_xxx', slugLocked: true };
    const next = applyPaintingPatch(p, { slugLocked: false });
    expect(next.slugLocked).toBe(false);
    expect(next.slug).toBe(generatePaintingSlug('Mountain', p.id));
  });

  it('keeps the current slug when toggling unlocked to locked', () => {
    const p = fresh('Sunset');
    const before = p.slug;
    const next = applyPaintingPatch(p, { slugLocked: true });
    expect(next.slugLocked).toBe(true);
    expect(next.slug).toBe(before);
  });

  it('does not touch slug for patches that change unrelated fields', () => {
    const p = fresh('Sunset');
    const before = p.slug;
    const next = applyPaintingPatch(p, { canvasW16: 64 });
    expect(next.slug).toBe(before);
    expect(next.canvasW16).toBe(64);
  });

  it('rederivates from new name when name and slugLocked=false are patched together', () => {
    const p = { ...fresh('Sunset'), slugLocked: true };
    const next = applyPaintingPatch(p, { name: 'Mountain', slugLocked: false });
    expect(next.slug).toBe(generatePaintingSlug('Mountain', p.id));
    expect(next.slugLocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/paintings/painting.test.ts`

Expected: all tests fail with module-not-found for `./painting`.

- [ ] **Step 3: Create the helper**

Create `src/paintings/painting.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/paintings/painting.test.ts`

Expected: all 7 tests pass.

- [ ] **Step 5: Type-check**

Run: `npm run check`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/paintings/painting.ts src/paintings/painting.test.ts
git commit -m "feat(paintings): add applyPaintingPatch helper for slug reconciliation"
```

---

### Task 3: Wire `applyPaintingPatch` into the rename input

**Files:**
- Modify: `src/ui/EditorHeader.svelte`
- Test: `src/ui/EditorHeader.test.ts`

- [ ] **Step 1: Inspect the existing tests**

Read `src/ui/EditorHeader.test.ts` to learn its style.

Run: `npx vitest run src/ui/EditorHeader.test.ts`

Expected: existing tests pass. Note the imports and helpers used.

- [ ] **Step 2: Add a failing test for auto-follow on rename**

Open `src/ui/EditorHeader.test.ts`. Append this test inside the existing `describe('EditorHeader', ...)` block (before the closing brace):

```typescript
  it('rederivates the slug from the new name when the painting is unlocked', async () => {
    const id = seed('Sunset');
    const { getByRole, getByLabelText } = render(EditorHeader, { props: { id } });
    await fireEvent.click(getByRole('button', { name: 'Sunset' }));
    const input = getByLabelText('Painting name') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Mountain' } });
    await fireEvent.blur(input);
    const p = get(project).paintings[0];
    expect(p.name).toBe('Mountain');
    expect(p.slug).toMatch(/^mountain_[0-9a-f]{8}$/);
  });

  it('preserves the slug on rename when the painting is locked', async () => {
    const id = seed('Sunset');
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? { ...p, slugLocked: true } : p),
    }));
    const beforeSlug = get(project).paintings[0].slug;
    const { getByRole, getByLabelText } = render(EditorHeader, { props: { id } });
    await fireEvent.click(getByRole('button', { name: 'Sunset' }));
    const input = getByLabelText('Painting name') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Mountain' } });
    await fireEvent.blur(input);
    expect(get(project).paintings[0].name).toBe('Mountain');
    expect(get(project).paintings[0].slug).toBe(beforeSlug);
  });
```

If the file does not already import `get` from `'svelte/store'` and `project` from `'../stores/project'`, add those imports. The `seed` helper should already exist in this test file (mirrors the one in `PaintingProperties.test.ts`); if it does not, copy this helper to the top of the describe block:

```typescript
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
function seed(name: string): string {
  const s = createEmptyProject();
  const p = createPaintingFromImage(name, { pngBase64: '', naturalW: 32, naturalH: 32 });
  s.paintings.push(p);
  project.set(s);
  return p.id;
}
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `npx vitest run src/ui/EditorHeader.test.ts`

Expected: the new unlocked test fails because the rename does NOT currently touch the slug (current code spreads `{ ...p, name }` only).

- [ ] **Step 4: Update `EditorHeader.svelte` to use the helper**

Edit `src/ui/EditorHeader.svelte` lines 1-3 (the `<script>` opening + imports). Add the import:

```svelte
<script lang="ts">
  import { project } from '../stores/project';
  import { applyPaintingPatch } from '../paintings/painting';
  export let id: string;
```

Edit the `commit` function (lines 13-21). Replace:

```typescript
  function commit() {
    const name = draft.trim();
    if (!name) { cancel(); return; }
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? { ...p, name } : p),
    }));
    editing = false;
  }
```

With:

```typescript
  function commit() {
    const name = draft.trim();
    if (!name) { cancel(); return; }
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? applyPaintingPatch(p, { name }) : p),
    }));
    editing = false;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui/EditorHeader.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/EditorHeader.svelte src/ui/EditorHeader.test.ts
git commit -m "feat(editor-header): rename through applyPaintingPatch so slug auto-follows"
```

---

### Task 4: Render the "In-game ID" section (read-only display + Copy button)

**Files:**
- Modify: `src/ui/PaintingProperties.svelte`
- Test: `src/ui/PaintingProperties.test.ts`

- [ ] **Step 1: Write failing tests for the section render and copy behavior**

Open `src/ui/PaintingProperties.test.ts`. Add these tests inside the existing `describe('PaintingProperties', ...)` block:

```typescript
  it('renders the In-game ID section showing namespace:slug', () => {
    const id = seed();
    const slug = get(project).paintings[0].slug;
    const ns = get(project).pack.namespace;
    const { getByText, getByLabelText } = render(PaintingProperties, { props: { id } });
    expect(getByText('In-game ID')).toBeTruthy();
    expect(getByText(`${ns}:`)).toBeTruthy();
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    expect(input.value).toBe(slug);
  });

  it('reactively updates the namespace prefix when pack.namespace changes', async () => {
    const id = seed();
    const { getByText } = render(PaintingProperties, { props: { id } });
    expect(getByText('paintings:')).toBeTruthy();
    project.update((v) => ({ ...v, pack: { ...v.pack, namespace: 'custom_ns' } }));
    await Promise.resolve();
    expect(getByText('custom_ns:')).toBeTruthy();
  });

  it('Copy button writes "<namespace>:<slug>" to the clipboard', async () => {
    const id = seed();
    const ns = get(project).pack.namespace;
    const slug = get(project).paintings[0].slug;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('button', { name: 'Copy in-game ID' }));
    expect(writeText).toHaveBeenCalledWith(`${ns}:${slug}`);
  });
```

If `vi` is not yet imported, add it to the existing vitest import:

```typescript
import { describe, it, expect, vi } from 'vitest';
```

If `get` is not yet imported, add it:

```typescript
import { get } from 'svelte/store';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/PaintingProperties.test.ts`

Expected: the three new tests fail (no In-game ID section yet).

- [ ] **Step 3: Add the section to the component**

Edit `src/ui/PaintingProperties.svelte`. Append a new `<section>` inside the `<aside>` (after the Transparency section, before `</aside>`):

```svelte
    <section>
      <h4 class="section-title">In-game ID</h4>
      <div class="id-row">
        <span class="id-prefix">{$project.pack.namespace}:</span>
        <input class="field id-slug"
          aria-label="In-game slug"
          value={painting.slug}
          readonly />
        <button type="button" class="id-btn"
          aria-label="Copy in-game ID"
          on:click={copyInGameId}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p class="field-hint">
        Used to summon this painting in-game (for example, with the /summon command).
      </p>
    </section>
```

In the `<script>` block at the top, add the `copied` state variable and the copy handler. Insert after the existing `parseDensity` function:

```typescript
  let copied = false;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  async function copyInGameId() {
    if (!painting) return;
    const text = `${$project.pack.namespace}:${painting.slug}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: select the input so the user can press Ctrl+C.
      const el = document.querySelector('.id-slug') as HTMLInputElement | null;
      el?.select();
      return;
    }
    copied = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copied = false; }, 1500);
  }
```

Add the styles to the existing `<style>` block (before the closing `</style>`):

```css
  .id-row { display: flex; gap: var(--space-2); align-items: center; }
  .id-prefix {
    font-size: var(--fs-xs); color: var(--text-muted); font-family: monospace;
    white-space: nowrap;
  }
  .id-slug { flex: 1; font-family: monospace; }
  .id-btn {
    padding: 5px var(--space-3); font-size: var(--fs-xs); font-weight: 600;
    color: var(--text-muted); border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm); background: #fff;
  }
  .id-btn:hover { background: var(--surface); }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui/PaintingProperties.test.ts`

Expected: all tests pass (including the three new ones plus existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/ui/PaintingProperties.svelte src/ui/PaintingProperties.test.ts
git commit -m "feat(painting-props): add In-game ID section with Copy button"
```

---

### Task 5: Add the lock toggle

**Files:**
- Modify: `src/ui/PaintingProperties.svelte`
- Test: `src/ui/PaintingProperties.test.ts`

- [ ] **Step 1: Write failing tests for the lock toggle**

Open `src/ui/PaintingProperties.test.ts`. Append inside the existing describe block:

```typescript
  it('lock button reflects slugLocked and toggles it on click', async () => {
    const id = seed();
    const { getByRole } = render(PaintingProperties, { props: { id } });
    const btn = getByRole('button', { name: /Lock|Unlock/ });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(btn);
    expect(get(project).paintings[0].slugLocked).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(btn);
    expect(get(project).paintings[0].slugLocked).toBe(false);
  });

  it('unlocking rederivates the slug from the current painting name', async () => {
    const id = seed();
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id
        ? { ...p, name: 'Mountain', slug: 'frozen_value', slugLocked: true }
        : p),
    }));
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('button', { name: /Unlock/ }));
    const p = get(project).paintings[0];
    expect(p.slugLocked).toBe(false);
    expect(p.slug).toMatch(/^mountain_[0-9a-f]{8}$/);
  });

  it('locking keeps the current slug unchanged', async () => {
    const id = seed();
    const before = get(project).paintings[0].slug;
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('button', { name: /Lock/ }));
    expect(get(project).paintings[0].slug).toBe(before);
    expect(get(project).paintings[0].slugLocked).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/PaintingProperties.test.ts`

Expected: the three new tests fail (no lock button yet).

- [ ] **Step 3: Add the lock button and handler**

Edit `src/ui/PaintingProperties.svelte`. In the `<script>` block, add the `applyPaintingPatch` import and a `toggleLock` function. Update imports:

```typescript
  import { project } from '../stores/project';
  import { resolveDensity } from '../paintings/density';
  import { applyPaintingPatch } from '../paintings/painting';
  import type { Painting, Density } from '../paintings/types';
```

Also update the existing `patch` function to use `applyPaintingPatch` so existing canvas/density/material/resampling patches go through the same path (no behavior change for them; this keeps a single mutation pathway):

Old:
```typescript
  function patch(update: Partial<Painting>) {
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? { ...p, ...update } : p),
    }));
  }
```

New:
```typescript
  function patch(update: Partial<Painting>) {
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? applyPaintingPatch(p, update) : p),
    }));
  }
  function toggleLock() {
    if (!painting) return;
    patch({ slugLocked: !painting.slugLocked });
  }
```

Update the section markup. Replace the `<div class="id-row">` block from Task 4 with:

```svelte
      <div class="id-row">
        <span class="id-prefix">{$project.pack.namespace}:</span>
        <input class="field id-slug"
          aria-label="In-game slug"
          value={painting.slug}
          readonly />
        <button type="button" class="id-btn id-lock"
          aria-label={painting.slugLocked ? 'Unlock slug' : 'Lock slug'}
          aria-pressed={painting.slugLocked}
          on:click={toggleLock}>{painting.slugLocked ? '🔒' : '🔓'}</button>
        <button type="button" class="id-btn"
          aria-label="Copy in-game ID"
          on:click={copyInGameId}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
```

Also update the hint paragraph to swap between the two variants. Replace:

```svelte
      <p class="field-hint">
        Used to summon this painting in-game (for example, with the /summon command).
      </p>
```

With:

```svelte
      <p class="field-hint">
        {#if painting.slugLocked}
          Custom value. Click the lock icon to resume auto-update from the painting name.
        {:else}
          Auto-updates with the painting name. Lock to keep the current value when renaming.
        {/if}
      </p>
```

Add styles to `<style>` (before the closing `</style>`):

```css
  .id-lock { font-size: var(--fs-sm); }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui/PaintingProperties.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/PaintingProperties.svelte src/ui/PaintingProperties.test.ts
git commit -m "feat(painting-props): add lock toggle with rederivation on unlock"
```

---

### Task 6: Make the slug input editable with validation and auto-lock

**Files:**
- Modify: `src/ui/PaintingProperties.svelte`
- Test: `src/ui/PaintingProperties.test.ts`

- [ ] **Step 1: Write failing tests for editing, validation, and auto-lock**

Open `src/ui/PaintingProperties.test.ts`. Append inside the existing describe block:

```typescript
  it('editing the slug auto-locks the painting and persists the value', async () => {
    const id = seed();
    const { getByLabelText } = render(PaintingProperties, { props: { id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'custom_slug' } });
    await fireEvent.blur(input);
    const p = get(project).paintings[0];
    expect(p.slug).toBe('custom_slug');
    expect(p.slugLocked).toBe(true);
  });

  it('shows an error and reverts on blur when the slug is invalid', async () => {
    const id = seed();
    const before = get(project).paintings[0].slug;
    const { getByLabelText, getByText } = render(PaintingProperties, { props: { id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Invalid-Slug!' } });
    expect(getByText(/lowercase a-z, 0-9, _/i)).toBeTruthy();
    await fireEvent.blur(input);
    expect(get(project).paintings[0].slug).toBe(before);
    expect(input.value).toBe(before);
  });

  it('rejects a slug longer than 32 characters', async () => {
    const id = seed();
    const before = get(project).paintings[0].slug;
    const { getByLabelText, getByText } = render(PaintingProperties, { props: { id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    const tooLong = 'a' + 'b'.repeat(32);
    await fireEvent.input(input, { target: { value: tooLong } });
    expect(getByText(/32 characters/i)).toBeTruthy();
    await fireEvent.blur(input);
    expect(get(project).paintings[0].slug).toBe(before);
  });

  it('rejects a slug that collides with another painting', async () => {
    const s = createEmptyProject();
    const a = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    const b = createPaintingFromImage('B', { pngBase64: '', naturalW: 32, naturalH: 32 });
    s.paintings.push(a, b);
    project.set(s);
    const beforeA = a.slug;
    const { getByLabelText, getByText } = render(PaintingProperties, { props: { id: a.id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: b.slug } });
    expect(getByText(/already used/i)).toBeTruthy();
    await fireEvent.blur(input);
    expect(get(project).paintings.find((p) => p.id === a.id)!.slug).toBe(beforeA);
  });

  it('accepts editing back to the existing slug (self is not a collision)', async () => {
    const id = seed();
    const before = get(project).paintings[0].slug;
    const { getByLabelText } = render(PaintingProperties, { props: { id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: before } });
    await fireEvent.blur(input);
    expect(get(project).paintings[0].slug).toBe(before);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/PaintingProperties.test.ts`

Expected: the new tests fail because the slug input is still `readonly` and there is no validation.

- [ ] **Step 3: Make the slug editable and add validation**

Edit `src/ui/PaintingProperties.svelte`. Add slug-editing state and validators to the `<script>` block, after the `toggleLock` function:

```typescript
  const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;
  const SLUG_MAX = 32;
  let slugDraft = '';
  let slugError: string | null = null;
  $: if (painting && slugDraft === '') slugDraft = painting.slug;
  $: if (painting && !slugError && slugDraft !== painting.slug) {
    // Keep draft in sync with external store changes (e.g. rename when unlocked)
    // only when the user is not actively editing (no pending validation error).
  }
  function validateSlug(value: string): string | null {
    if (!value) return 'Slug cannot be empty.';
    if (value.length > SLUG_MAX) return `Use at most ${SLUG_MAX} characters.`;
    if (!SLUG_PATTERN.test(value)) return 'Use lowercase a-z, 0-9, _ (must start with a letter).';
    const collision = $project.paintings.some((p) => p.id !== id && p.slug === value);
    if (collision) return 'This ID is already used by another painting.';
    return null;
  }
  function onSlugInput(e: Event) {
    slugDraft = (e.currentTarget as HTMLInputElement).value;
    slugError = validateSlug(slugDraft);
  }
  function onSlugBlur() {
    if (!painting) return;
    if (slugError || !SLUG_PATTERN.test(slugDraft) || slugDraft.length > SLUG_MAX || !slugDraft) {
      slugDraft = painting.slug;
      slugError = null;
      return;
    }
    if (slugDraft === painting.slug) { slugError = null; return; }
    patch({ slug: slugDraft, slugLocked: true });
    slugError = null;
  }
```

The reactive `$:` block that keeps `slugDraft` in sync with external store changes needs to handle the case where the painting changes (e.g. user renamed it elsewhere and the slug rederivated). Replace the placeholder reactive block above with this single reactive statement:

```typescript
  let lastSyncedSlug = '';
  $: if (painting && painting.slug !== lastSyncedSlug && document.activeElement?.getAttribute('aria-label') !== 'In-game slug') {
    slugDraft = painting.slug;
    slugError = null;
    lastSyncedSlug = painting.slug;
  }
```

So the final block inside `<script>` (replacing the placeholder) is:

```typescript
  const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;
  const SLUG_MAX = 32;
  let slugDraft = '';
  let slugError: string | null = null;
  let lastSyncedSlug = '';
  $: if (painting && painting.slug !== lastSyncedSlug && document.activeElement?.getAttribute('aria-label') !== 'In-game slug') {
    slugDraft = painting.slug;
    slugError = null;
    lastSyncedSlug = painting.slug;
  }
  function validateSlug(value: string): string | null {
    if (!value) return 'Slug cannot be empty.';
    if (value.length > SLUG_MAX) return `Use at most ${SLUG_MAX} characters.`;
    if (!SLUG_PATTERN.test(value)) return 'Use lowercase a-z, 0-9, _ (must start with a letter).';
    const collision = $project.paintings.some((p) => p.id !== id && p.slug === value);
    if (collision) return 'This ID is already used by another painting.';
    return null;
  }
  function onSlugInput(e: Event) {
    slugDraft = (e.currentTarget as HTMLInputElement).value;
    slugError = validateSlug(slugDraft);
  }
  function onSlugBlur() {
    if (!painting) return;
    if (slugError) {
      slugDraft = painting.slug;
      slugError = null;
      return;
    }
    if (slugDraft === painting.slug) return;
    patch({ slug: slugDraft, slugLocked: true });
  }
```

Update the slug `<input>` markup. Replace:

```svelte
        <input class="field id-slug"
          aria-label="In-game slug"
          value={painting.slug}
          readonly />
```

With:

```svelte
        <input class="field id-slug"
          class:invalid={slugError !== null}
          aria-label="In-game slug"
          value={slugDraft}
          on:input={onSlugInput}
          on:blur={onSlugBlur} />
```

Below the `.id-row` div (still inside the section, before the `.field-hint` paragraph), add the error display:

```svelte
      {#if slugError}<span class="err">{slugError}</span>{/if}
```

Add styles to `<style>` (before the closing `</style>`):

```css
  .id-slug.invalid { border-color: var(--danger, #c00); }
  .err {
    display: block; margin-top: var(--space-1);
    font-size: var(--fs-xs); color: var(--danger, #c00);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui/PaintingProperties.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/PaintingProperties.svelte src/ui/PaintingProperties.test.ts
git commit -m "feat(painting-props): editable slug with validation and auto-lock"
```

---

### Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 2: Type-check**

Run: `npm run check`

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` and open the app in a browser.

Checklist:
1. Create a new painting from an image. The In-game ID section shows `paintings:<auto_slug>`. Lock icon shows the unlocked glyph.
2. Click the painting title in the header and rename it. The slug in the In-game ID section updates accordingly.
3. Click the lock icon. The hint text switches, lock glyph changes to locked.
4. Rename the painting again. The slug stays put.
5. Click the lock icon again to unlock. The slug snaps back to the derived value from the current name.
6. Type a custom slug (e.g. `my_painting`) and tab out. The slug is saved, lock icon flips to locked automatically.
7. Type `Invalid-Slug!` and observe the inline error. Tab out: the field reverts to the previously saved value.
8. Type a slug that matches another painting's slug, observe the collision error.
9. Click Copy. Paste in a text field elsewhere: the value is `<namespace>:<slug>`.
10. Open a project saved before this change (if one is available): every painting is locked; slugs are unchanged.

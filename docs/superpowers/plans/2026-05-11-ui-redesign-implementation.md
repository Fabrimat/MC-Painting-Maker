# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Modern Studio" UI redesign from `docs/superpowers/specs/2026-05-11-ui-redesign-design.md` — friendly labels, polished layout, responsive desktop ↔ mobile, no schema changes.

**Architecture:** Replace the existing 3-column raw layout with a tokenised design system (CSS variables in `app.css`), a topbar + drawer pattern for pack settings, a right-side properties panel composed of small Svelte components, and a single `@media (max-width: 899px)` breakpoint that swaps to a bottom-tab layout. New components live under `web/src/ui/`; the existing `PaintingEditor` keeps only canvas concerns.

**Tech Stack:** Svelte 4, TypeScript, Vite, Vitest + `@testing-library/svelte` (already in `devDependencies`), happy-dom test environment.

---

## File Structure

**New files:**
- `web/src/app.css` — replaced with design tokens + reset (existing file, full rewrite)
- `web/src/stores/ui.ts` — `activeTab`, `packDrawerOpen` writables
- `web/src/ui/Topbar.svelte` — brand + Import/Export + ⚙ + Build CTA
- `web/src/ui/PaintingList.svelte` — extracted list of painting rows (no add card)
- `web/src/ui/EditorHeader.svelte` — click-to-rename title above the canvas
- `web/src/ui/PaintingProperties.svelte` — right-side properties form with friendly labels
- `web/src/ui/PackDrawer.svelte` — slide-in drawer (desktop) / full-screen sheet (mobile)
- `web/src/ui/TabBar.svelte` — mobile bottom tabs
- `web/src/ui/EmptyState.svelte` — centered "start by adding an image" card

**Modified files:**
- `web/src/App.svelte` — full rewrite: topbar + responsive 3-col / mobile-tab body
- `web/src/ui/Sidebar.svelte` — rewrite: wraps the file drop + `PaintingList`; no inline rename
- `web/src/ui/FileDrop.svelte` — restyle as the AddCard
- `web/src/editor/PaintingEditor.svelte` — strip the `.bar` toolbar; canvas only

**Deleted files:**
- `web/src/ui/PackSettings.svelte` — replaced by `PackDrawer.svelte`

---

### Task 1: Design tokens + global reset

**Files:**
- Modify: `web/src/app.css` (full rewrite)

- [ ] **Step 1: Replace app.css with token system**

Replace the entire contents of `web/src/app.css`:

```css
:root {
  color-scheme: light;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;

  /* Palette */
  --bg:           #ffffff;
  --surface:      #fafbfc;
  --surface-2:    #f4f5f7;
  --border:       #e5e7eb;
  --border-strong:#d1d5db;
  --text:         #1f2937;
  --text-muted:   #6b7280;
  --text-faint:   #94a3b8;
  --primary:      #3b82f6;
  --primary-tint: #eff6ff;
  --primary-border:#bfdbfe;
  --primary-deep: #1e40af;
  --cta:          #f97316;
  --cta-hover:    #ea580c;
  --danger:       #dc2626;
  --danger-tint:  #fee2e2;

  /* Sizes */
  --fs-xs: 10px; --fs-sm: 11px; --fs-base: 12px; --fs-md: 13px; --fs-lg: 15px;
  --space-1: 4px; --space-2: 6px; --space-3: 8px; --space-4: 10px;
  --space-5: 12px; --space-6: 14px; --space-7: 16px; --space-8: 18px;
  --radius-sm: 5px; --radius: 7px; --radius-lg: 10px; --radius-xl: 14px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,.06);
  --shadow:    0 1px 3px rgba(0,0,0,.04);
  --shadow-lg: -12px 0 28px rgba(0,0,0,.12);
}

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text); font-size: var(--fs-base); }
button { font: inherit; color: inherit; cursor: pointer; background: none; border: 0; padding: 0; }
input, select { font: inherit; color: inherit; }
input:focus-visible, select:focus-visible, button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}

/* Shared field style — applied via .field class so inline tokens stay light */
.field {
  background: #fff; border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  padding: 6px 9px; font-size: var(--fs-sm); color: var(--text);
  width: 100%;
}
.field:focus-visible { border-color: var(--primary); outline: 3px solid var(--primary-tint); outline-offset: 0; }
.field.invalid { border-color: var(--danger); }

.section-title {
  font-size: var(--fs-xs); font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .06em;
  margin: 0 0 var(--space-3) 0;
  display: flex; align-items: center; gap: var(--space-2);
}
.section-title::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--primary);
}

.field-label { font-size: var(--fs-sm); color: var(--text); margin-bottom: var(--space-1); font-weight: 500; }
.field-hint  { font-size: var(--fs-xs); color: var(--text-faint); margin-bottom: var(--space-1); }
```

- [ ] **Step 2: Verify app builds with the new tokens**

Run: `cd web && npm run check`
Expected: no svelte-check errors.

Then run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/src/app.css
git commit -m "feat(ui): introduce design tokens and global reset"
```

---

### Task 2: UI store for tabs and drawer

**Files:**
- Create: `web/src/stores/ui.ts`
- Test: `web/src/stores/ui.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/stores/ui.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { activeTab, packDrawerOpen } from './ui';

describe('ui store', () => {
  it('defaults to the paintings tab and a closed drawer', () => {
    expect(get(activeTab)).toBe('paintings');
    expect(get(packDrawerOpen)).toBe(false);
  });

  it('lets activeTab move between the three tabs', () => {
    activeTab.set('edit');
    expect(get(activeTab)).toBe('edit');
    activeTab.set('properties');
    expect(get(activeTab)).toBe('properties');
    activeTab.set('paintings');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/stores/ui.test.ts`
Expected: FAIL — cannot find module `./ui`.

- [ ] **Step 3: Create the store**

Create `web/src/stores/ui.ts`:

```ts
import { writable } from 'svelte/store';

export type Tab = 'paintings' | 'edit' | 'properties';

export const activeTab = writable<Tab>('paintings');
export const packDrawerOpen = writable<boolean>(false);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/stores/ui.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/stores/ui.ts web/src/stores/ui.test.ts
git commit -m "feat(ui): add ui store for tab and pack-drawer state"
```

---

### Task 3: EmptyState component

**Files:**
- Create: `web/src/ui/EmptyState.svelte`

- [ ] **Step 1: Write the component**

Create `web/src/ui/EmptyState.svelte`:

```svelte
<script lang="ts">
  export let title: string = 'Start by adding an image';
  export let body: string = 'Drop PNG or JPEG files into the sidebar, or click "Add images" to pick from your computer.';
</script>

<div class="empty" role="status">
  <div class="ill" aria-hidden="true">🖼</div>
  <h3>{title}</h3>
  <p>{body}</p>
</div>

<style>
  .empty { text-align: center; padding: 40px 24px; color: var(--text-muted); }
  .ill { font-size: 36px; margin-bottom: var(--space-3); }
  h3 { font-size: var(--fs-md); font-weight: 700; color: var(--text); margin: 0 0 var(--space-1) 0; }
  p  { font-size: var(--fs-sm); margin: 0; line-height: 1.5; }
</style>
```

- [ ] **Step 2: Verify svelte-check passes**

Run: `cd web && npm run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/ui/EmptyState.svelte
git commit -m "feat(ui): add EmptyState card"
```

---

### Task 4: Restyle FileDrop as the AddCard

**Files:**
- Modify: `web/src/ui/FileDrop.svelte`

- [ ] **Step 1: Rewrite FileDrop with the new look**

Replace the entire contents of `web/src/ui/FileDrop.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ files: FileList }>();
  let dragOver = false;

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer?.files?.length) dispatch('files', e.dataTransfer.files);
  }
  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.length) dispatch('files', t.files);
    t.value = '';
  }
</script>

<label
  class="add-card" class:over={dragOver}
  on:dragover|preventDefault={() => (dragOver = true)}
  on:dragleave={() => (dragOver = false)}
  on:drop={onDrop}
>
  <span class="plus" aria-hidden="true">+</span>
  <span class="label">
    <span class="title">Add images</span>
    <small>drag &amp; drop or click</small>
  </span>
  <input type="file" multiple accept="image/png,image/jpeg" on:change={onPick} hidden />
</label>

<style>
  .add-card {
    display: flex; align-items: center; gap: var(--space-4);
    padding: var(--space-5); border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-lg); background: var(--bg);
    color: var(--text-muted); cursor: pointer; user-select: none;
    transition: border-color .12s, background .12s;
  }
  .add-card:hover, .add-card.over {
    border-color: var(--primary); background: var(--primary-tint);
  }
  .plus {
    width: 32px; height: 32px; flex: 0 0 auto;
    border-radius: var(--radius); background: var(--primary-tint); color: var(--primary);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 700; line-height: 1;
  }
  .label { display: flex; flex-direction: column; }
  .title { font-size: var(--fs-sm); font-weight: 600; color: var(--text); }
  small  { font-size: var(--fs-xs); color: var(--text-faint); font-weight: 400; }
</style>
```

- [ ] **Step 2: Run existing tests to make sure nothing broke**

Run: `cd web && npm test`
Expected: existing tests pass (FileDrop has no tests, just used by Sidebar).

- [ ] **Step 3: Commit**

```bash
git add web/src/ui/FileDrop.svelte
git commit -m "feat(ui): restyle FileDrop as the Add images card"
```

---

### Task 5: PaintingList component

**Files:**
- Create: `web/src/ui/PaintingList.svelte`
- Test: `web/src/ui/PaintingList.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/ui/PaintingList.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PaintingList from './PaintingList.svelte';
import type { Painting } from '../paintings/types';

function painting(id: string, name: string): Painting {
  return {
    id, name,
    canvasW16: 32, canvasH16: 32,
    transform: { x16: 0, y16: 0, w16: 32, h16: 32 },
    source: null,
    textureDensity: 'auto', resampling: 'smooth', material: 'alphatest',
  } as Painting;
}

describe('PaintingList', () => {
  it('renders one row per painting with name and size', () => {
    const { getByText } = render(PaintingList, {
      props: { paintings: [painting('a', 'Sunset'), painting('b', 'Forest')], selectedId: null },
    });
    expect(getByText('Sunset')).toBeTruthy();
    expect(getByText('Forest')).toBeTruthy();
    expect(getByText('2.00 × 2.00 blocks').length ?? 1).toBeGreaterThan(0);
  });

  it('does NOT render a rename input on rows', () => {
    const { container } = render(PaintingList, {
      props: { paintings: [painting('a', 'Sunset')], selectedId: null },
    });
    expect(container.querySelectorAll('input[type="text"]').length).toBe(0);
  });

  it('emits select when a row is clicked', async () => {
    const { getByRole, component } = render(PaintingList, {
      props: { paintings: [painting('a', 'Sunset')], selectedId: null },
    });
    const fn = vi.fn();
    component.$on('select', (e) => fn(e.detail));
    await fireEvent.click(getByRole('button', { name: /Sunset/ }));
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('emits remove when the ✕ button is clicked', async () => {
    const { container, component } = render(PaintingList, {
      props: { paintings: [painting('a', 'Sunset')], selectedId: 'a' },
    });
    const fn = vi.fn();
    component.$on('remove', (e) => fn(e.detail));
    const del = container.querySelector('.p-del') as HTMLButtonElement;
    await fireEvent.click(del);
    expect(fn).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/PaintingList.test.ts`
Expected: FAIL — cannot find module `./PaintingList.svelte`.

- [ ] **Step 3: Create the component**

Create `web/src/ui/PaintingList.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Painting } from '../paintings/types';
  export let paintings: Painting[] = [];
  export let selectedId: string | null = null;
  const dispatch = createEventDispatcher<{ select: string; remove: string }>();
  function sizeLabel(p: Painting) {
    return `${(p.canvasW16/16).toFixed(2)} × ${(p.canvasH16/16).toFixed(2)} blocks`;
  }
</script>

<ul>
  {#each paintings as p (p.id)}
    <li class:sel={selectedId === p.id}>
      <button
        type="button" class="row"
        aria-label={`Select ${p.name}`}
        aria-pressed={selectedId === p.id}
        on:click={() => dispatch('select', p.id)}
      >
        <span class="thumb">
          {#if p.source}
            <img src={`data:image/png;base64,${p.source.pngBase64}`} alt="" />
          {/if}
        </span>
        <span class="meta">
          <span class="name">{p.name}</span>
          <span class="size">{sizeLabel(p)}</span>
        </span>
      </button>
      <button
        type="button" class="p-del"
        aria-label={`Delete ${p.name}`}
        on:click|stopPropagation={() => dispatch('remove', p.id)}
      >✕</button>
    </li>
  {/each}
</ul>

<style>
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; align-items: center; border-radius: var(--radius); margin-bottom: var(--space-1); }
  li:hover { background: var(--surface); }
  li.sel { background: var(--primary-tint); box-shadow: inset 0 0 0 1px var(--primary-border); }
  .row {
    flex: 1; display: flex; align-items: center; gap: var(--space-4);
    padding: var(--space-2) var(--space-3); border-radius: var(--radius);
    min-width: 0; text-align: left;
  }
  .thumb {
    width: 32px; height: 32px; flex: 0 0 auto;
    border-radius: var(--radius-sm); background: var(--surface-2);
    overflow: hidden; box-shadow: inset 0 0 0 1px rgba(0,0,0,.05);
    display: inline-flex; align-items: center; justify-content: center;
  }
  .thumb img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
  .meta { display: flex; flex-direction: column; min-width: 0; }
  .name { font-size: var(--fs-sm); font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .size { font-size: var(--fs-xs); color: var(--text-muted); }
  .p-del {
    width: 26px; height: 26px; margin-right: var(--space-2);
    color: var(--text-faint); border-radius: var(--radius-sm);
    opacity: 0; transition: opacity .12s, background .12s, color .12s;
    display: inline-flex; align-items: center; justify-content: center;
  }
  li:hover .p-del, li.sel .p-del { opacity: 1; }
  .p-del:hover { background: var(--danger-tint); color: var(--danger); }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/ui/PaintingList.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/PaintingList.svelte web/src/ui/PaintingList.test.ts
git commit -m "feat(ui): add PaintingList without inline rename"
```

---

### Task 6: Rewrite Sidebar

**Files:**
- Modify: `web/src/ui/Sidebar.svelte`
- Test: `web/src/ui/Sidebar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/ui/Sidebar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Sidebar from './Sidebar.svelte';
import { project } from '../stores/project';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';

describe('Sidebar', () => {
  it('renders the Add images card and the painting count', () => {
    project.set(createEmptyProject());
    const { getByText } = render(Sidebar, { props: { selectedId: null } });
    expect(getByText('Add images')).toBeTruthy();
    expect(getByText(/Paintings · 0/)).toBeTruthy();
  });

  it('does NOT render any rename input', () => {
    const s = createEmptyProject();
    s.paintings.push(createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 }));
    project.set(s);
    const { container } = render(Sidebar, { props: { selectedId: null } });
    expect(container.querySelectorAll('input[type="text"]').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/Sidebar.test.ts`
Expected: FAIL (current Sidebar renders rename inputs).

- [ ] **Step 3: Rewrite Sidebar**

Replace the entire contents of `web/src/ui/Sidebar.svelte`:

```svelte
<script lang="ts">
  import { project } from '../stores/project';
  import { createPaintingFromImage, ensurePackUUIDs } from '../paintings/defaults';
  import type { Painting } from '../paintings/types';
  import FileDrop from './FileDrop.svelte';
  import PaintingList from './PaintingList.svelte';
  export let selectedId: string | null;

  async function addFromFiles(files: FileList) {
    const additions: Painting[] = [];
    for (const f of Array.from(files)) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const dataUrl = await fileDataUrl(f);
      const bmp = await createImageBitmap(new Blob([bytes], { type: f.type }));
      additions.push(createPaintingFromImage(
        stripExt(f.name),
        { pngBase64: dataUrl, naturalW: bmp.width, naturalH: bmp.height },
      ));
    }
    project.update((v) => {
      const withUuids = ensurePackUUIDs(v);
      return { ...withUuids, paintings: [...withUuids.paintings, ...additions] };
    });
    if (selectedId === null && additions.length > 0) selectedId = additions[0].id;
  }

  function fileDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const v = String(fr.result);
        const idx = v.indexOf(',');
        resolve(idx >= 0 ? v.slice(idx + 1) : v);
      };
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(f);
    });
  }

  function stripExt(name: string): string { return name.replace(/\.[^.]+$/, ''); }

  function remove(id: string) {
    project.update((v) => ({ ...v, paintings: v.paintings.filter((p) => p.id !== id) }));
    if (selectedId === id) selectedId = null;
  }
</script>

<aside class="sidebar">
  <h4 class="title">Paintings · {$project.paintings.length}</h4>
  <FileDrop on:files={(e) => addFromFiles(e.detail)} />
  <PaintingList
    paintings={$project.paintings}
    {selectedId}
    on:select={(e) => (selectedId = e.detail)}
    on:remove={(e) => remove(e.detail)}
  />
</aside>

<style>
  .sidebar { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); height: 100%; overflow: auto; }
  .title {
    font-size: var(--fs-xs); font-weight: 700; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: .06em; margin: 0;
    padding: 0 var(--space-1);
  }
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/ui/Sidebar.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/Sidebar.svelte web/src/ui/Sidebar.test.ts
git commit -m "feat(ui): rewrite Sidebar without inline rename"
```

---

### Task 7: EditorHeader (click-to-rename)

**Files:**
- Create: `web/src/ui/EditorHeader.svelte`
- Test: `web/src/ui/EditorHeader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/ui/EditorHeader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import EditorHeader from './EditorHeader.svelte';
import { project } from '../stores/project';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { get } from 'svelte/store';

function seedWithPainting(name = 'Sunset'): string {
  const s = createEmptyProject();
  const p = createPaintingFromImage(name, { pngBase64: '', naturalW: 32, naturalH: 32 });
  s.paintings.push(p);
  project.set(s);
  return p.id;
}

describe('EditorHeader', () => {
  it('shows the painting name and a "click to rename" hint', () => {
    const id = seedWithPainting('Sunset');
    const { getByText } = render(EditorHeader, { props: { id } });
    expect(getByText('Sunset')).toBeTruthy();
    expect(getByText(/click to rename/i)).toBeTruthy();
  });

  it('click swaps the title for an input; Enter commits to the store', async () => {
    const id = seedWithPainting('Sunset');
    const { getByText, getByRole } = render(EditorHeader, { props: { id } });
    await fireEvent.click(getByText('Sunset'));
    const input = getByRole('textbox') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Dawn' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(get(project).paintings[0].name).toBe('Dawn');
  });

  it('Escape reverts to the old name and exits edit mode', async () => {
    const id = seedWithPainting('Sunset');
    const { getByText, getByRole, queryByRole } = render(EditorHeader, { props: { id } });
    await fireEvent.click(getByText('Sunset'));
    const input = getByRole('textbox') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Dawn' } });
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(get(project).paintings[0].name).toBe('Sunset');
    expect(queryByRole('textbox')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/EditorHeader.test.ts`
Expected: FAIL — cannot find module `./EditorHeader.svelte`.

- [ ] **Step 3: Create the component**

Create `web/src/ui/EditorHeader.svelte`:

```svelte
<script lang="ts">
  import { project } from '../stores/project';
  export let id: string;
  let editing = false;
  let draft = '';
  $: painting = $project.paintings.find((p) => p.id === id) ?? null;

  function startEditing() {
    if (!painting) return;
    draft = painting.name;
    editing = true;
  }
  function commit() {
    const name = draft.trim();
    if (!name) { cancel(); return; }
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? { ...p, name } : p),
    }));
    editing = false;
  }
  function cancel() { editing = false; }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') cancel();
  }
  function autofocus(node: HTMLInputElement) { node.focus(); node.select(); }
</script>

{#if painting}
  <header class="editor-header">
    {#if editing}
      <input
        class="title-input"
        type="text"
        bind:value={draft}
        on:keydown={onKeyDown}
        on:blur={commit}
        use:autofocus
        aria-label="Painting name"
      />
    {:else}
      <button type="button" class="title" on:click={startEditing}>{painting.name}</button>
      <span class="hint">· click to rename</span>
    {/if}
  </header>
{/if}

<style>
  .editor-header {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-5) var(--space-7);
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .title {
    font-size: var(--fs-lg); font-weight: 700; color: var(--text);
    padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid transparent;
  }
  .title:hover { border-color: var(--border); background: var(--surface); }
  .title-input {
    font-size: var(--fs-lg); font-weight: 700; color: var(--text);
    padding: 2px 6px; border-radius: var(--radius-sm);
    border: 1px solid var(--primary); outline: 3px solid var(--primary-tint);
    background: #fff;
  }
  .hint { font-size: var(--fs-sm); color: var(--text-muted); }
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/ui/EditorHeader.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/EditorHeader.svelte web/src/ui/EditorHeader.test.ts
git commit -m "feat(ui): add EditorHeader with click-to-rename"
```

---

### Task 8: PaintingProperties

**Files:**
- Create: `web/src/ui/PaintingProperties.svelte`
- Test: `web/src/ui/PaintingProperties.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/ui/PaintingProperties.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PaintingProperties from './PaintingProperties.svelte';
import { project } from '../stores/project';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';

function seed(): string {
  const s = createEmptyProject();
  const p = createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 });
  s.paintings.push(p);
  project.set(s);
  return p.id;
}

describe('PaintingProperties', () => {
  it('renders the three friendly section titles', () => {
    const id = seed();
    const { getByText } = render(PaintingProperties, { props: { id } });
    expect(getByText('Canvas size')).toBeTruthy();
    expect(getByText('Texture quality')).toBeTruthy();
    expect(getByText('Transparency')).toBeTruthy();
  });

  it('Cutout / Blended pill writes alphatest / alphablend to the schema', async () => {
    const id = seed();
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('radio', { name: /Blended/ }));
    expect(get(project).paintings[0].material).toBe('alphablend');
    await fireEvent.click(getByRole('radio', { name: /Cutout/ }));
    expect(get(project).paintings[0].material).toBe('alphatest');
  });

  it('Smooth / Pixel art pill writes smooth / pixelated to the schema', async () => {
    const id = seed();
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('radio', { name: /Pixel art/ }));
    expect(get(project).paintings[0].resampling).toBe('pixelated');
    await fireEvent.click(getByRole('radio', { name: /Smooth/ }));
    expect(get(project).paintings[0].resampling).toBe('smooth');
  });

  it('Width input updates canvasW16 to round(blocks * 16)', async () => {
    const id = seed();
    const { getByLabelText } = render(PaintingProperties, { props: { id } });
    const w = getByLabelText(/Width/) as HTMLInputElement;
    await fireEvent.input(w, { target: { value: '2.5' } });
    expect(get(project).paintings[0].canvasW16).toBe(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/PaintingProperties.test.ts`
Expected: FAIL — cannot find module `./PaintingProperties.svelte`.

- [ ] **Step 3: Create the component**

Create `web/src/ui/PaintingProperties.svelte`:

```svelte
<script lang="ts">
  import { project } from '../stores/project';
  import { resolveDensity } from '../paintings/density';
  import type { Painting, Density, Resampling, Material } from '../paintings/types';
  export let id: string;
  $: painting = $project.paintings.find((p) => p.id === id) ?? null;
  $: density = painting ? resolveDensity(painting) : 1;

  function patch(update: Partial<Painting>) {
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? { ...p, ...update } : p),
    }));
  }
  function setCanvas(axis: 'W' | 'H', blocks: number) {
    if (!Number.isFinite(blocks) || blocks <= 0) return;
    const v = Math.max(1, Math.round(blocks * 16));
    patch(axis === 'W' ? { canvasW16: v } : { canvasH16: v });
  }
  function parseDensity(v: string): Density {
    if (v === 'auto') return 'auto';
    const n = Number(v);
    if ([1,2,4,8,16,32,64].includes(n)) return n as Density;
    return 'auto';
  }
</script>

{#if painting}
  <aside class="props" aria-label="Painting properties">
    <section>
      <h4 class="section-title">Canvas size</h4>
      <div class="row2">
        <label class="stack">
          <span class="field-label">Width</span>
          <span class="with-suffix">
            <input class="field" type="number" step="0.0625" min="0.0625"
              aria-label="Width in blocks"
              value={painting.canvasW16 / 16}
              on:input={(e) => setCanvas('W', e.currentTarget.valueAsNumber)} />
            <span class="suffix">blocks</span>
          </span>
        </label>
        <label class="stack">
          <span class="field-label">Height</span>
          <span class="with-suffix">
            <input class="field" type="number" step="0.0625" min="0.0625"
              aria-label="Height in blocks"
              value={painting.canvasH16 / 16}
              on:input={(e) => setCanvas('H', e.currentTarget.valueAsNumber)} />
            <span class="suffix">blocks</span>
          </span>
        </label>
      </div>
    </section>

    <section>
      <h4 class="section-title">Texture quality</h4>
      <label class="stack">
        <span class="field-label">Resolution</span>
        <span class="field-hint">Pixels per 1/16-block — higher means more detail.</span>
        <select class="field"
          value={painting.textureDensity}
          on:change={(e) => patch({ textureDensity: parseDensity(e.currentTarget.value) })}>
          <option value="auto">Auto · {density}× · {painting.canvasW16 * density}×{painting.canvasH16 * density} px</option>
          {#each [1,2,4,8,16,32,64] as n}<option value={n}>{n}× · {painting.canvasW16 * n}×{painting.canvasH16 * n} px</option>{/each}
        </select>
      </label>

      <label class="stack">
        <span class="field-label">Scaling</span>
        <span class="pills" role="radiogroup" aria-label="Scaling">
          <button type="button" role="radio"
            aria-checked={painting.resampling === 'smooth'}
            class:on={painting.resampling === 'smooth'}
            on:click={() => patch({ resampling: 'smooth' as Resampling })}>Smooth</button>
          <button type="button" role="radio"
            aria-checked={painting.resampling === 'pixelated'}
            class:on={painting.resampling === 'pixelated'}
            on:click={() => patch({ resampling: 'pixelated' as Resampling })}>Pixel art</button>
        </span>
      </label>
    </section>

    <section>
      <h4 class="section-title">Transparency</h4>
      <span class="pills" role="radiogroup" aria-label="Transparency">
        <button type="button" role="radio"
          aria-checked={painting.material === 'alphatest'}
          class:on={painting.material === 'alphatest'}
          on:click={() => patch({ material: 'alphatest' as Material })}>Cutout</button>
        <button type="button" role="radio"
          aria-checked={painting.material === 'alphablend'}
          class:on={painting.material === 'alphablend'}
          on:click={() => patch({ material: 'alphablend' as Material })}>Blended</button>
      </span>
      <p class="field-hint" style="margin-top: var(--space-2)">
        Cutout = sharp edges (best for pixel art). Blended = soft, translucent edges.
      </p>
    </section>
  </aside>
{/if}

<style>
  .props { padding: var(--space-7); background: var(--surface); overflow: auto; height: 100%; }
  section { margin-bottom: var(--space-8); }
  section:last-child { margin-bottom: 0; }
  .stack { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-3); }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .with-suffix { position: relative; display: flex; }
  .with-suffix .field { padding-right: 44px; }
  .with-suffix .suffix {
    position: absolute; right: var(--space-3); top: 50%; transform: translateY(-50%);
    font-size: var(--fs-xs); color: var(--text-faint); pointer-events: none;
  }
  .pills {
    display: flex; gap: var(--space-1); background: #fff;
    padding: 3px; border: 1px solid var(--border-strong); border-radius: var(--radius);
  }
  .pills > button {
    flex: 1; padding: 5px var(--space-2); font-size: var(--fs-xs); font-weight: 600;
    color: var(--text-muted); border-radius: var(--radius-sm);
  }
  .pills > button.on {
    background: var(--primary-tint); color: var(--primary-deep);
    box-shadow: inset 0 0 0 1px var(--primary-border);
  }
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/ui/PaintingProperties.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/PaintingProperties.svelte web/src/ui/PaintingProperties.test.ts
git commit -m "feat(ui): add PaintingProperties with friendly labels and pill toggles"
```

---

### Task 9: Strip the toolbar out of PaintingEditor

**Files:**
- Modify: `web/src/editor/PaintingEditor.svelte`

- [ ] **Step 1: Rewrite PaintingEditor without the .bar toolbar**

Replace the entire contents of `web/src/editor/PaintingEditor.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Konva from 'konva';
  import { project } from '../stores/project';

  export let id: string;

  let host: HTMLDivElement;
  let stage: Konva.Stage | null = null;
  let bgLayer: Konva.Layer;
  let imageLayer: Konva.Layer;
  let gridLayer: Konva.Layer;
  let imageNode: Konva.Image | null = null;

  $: painting = $project.paintings.find((p) => p.id === id) ?? null;

  let pps = 12;

  onMount(async () => {
    stage = new Konva.Stage({ container: host, width: host.clientWidth, height: host.clientHeight });
    bgLayer = new Konva.Layer();
    imageLayer = new Konva.Layer();
    gridLayer = new Konva.Layer();
    stage.add(bgLayer, imageLayer, gridLayer);
    await refresh();
  });

  onDestroy(() => stage?.destroy());

  async function refresh() {
    if (!stage || !painting) return;
    stage.size({ width: host.clientWidth, height: host.clientHeight });
    bgLayer.destroyChildren();
    imageLayer.destroyChildren();
    gridLayer.destroyChildren();
    drawCheckerboard();
    await drawImage();
    drawGrid();
    centerAndConfigurePan();
    bgLayer.draw(); imageLayer.draw(); gridLayer.draw();
  }

  function centerAndConfigurePan() {
    if (!stage || !painting) return;
    const canvasW = painting.canvasW16 * pps;
    const canvasH = painting.canvasH16 * pps;
    const hostW = stage.width();
    const hostH = stage.height();
    stage.position({ x: (hostW - canvasW) / 2, y: (hostH - canvasH) / 2 });
    const overflows = canvasW > hostW || canvasH > hostH;
    stage.draggable(overflows);
  }

  function drawCheckerboard() {
    if (!painting) return;
    const W = painting.canvasW16 * pps;
    const H = painting.canvasH16 * pps;
    const cell = pps;
    bgLayer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: '#f0f0f0', listening: false }));
    for (let y = 0; y < painting.canvasH16; y++) {
      for (let x = 0; x < painting.canvasW16; x++) {
        if ((x + y) % 2 === 0) {
          bgLayer.add(new Konva.Rect({
            x: x * cell, y: y * cell, width: cell, height: cell, fill: '#e0e0e0', listening: false,
          }));
        }
      }
    }
  }

  async function drawImage() {
    if (!painting?.source) return;
    const img = new Image();
    img.src = `data:image/png;base64,${painting.source.pngBase64}`;
    await new Promise<void>((r, e) => { img.onload = () => r(); img.onerror = () => e(new Error('image load')); });
    imageNode = new Konva.Image({
      image: img,
      x: painting.transform.x16 * pps,
      y: painting.transform.y16 * pps,
      width: painting.transform.w16 * pps,
      height: painting.transform.h16 * pps,
      draggable: true,
    });
    imageNode.on('dragmove', () => {
      if (!imageNode) return;
      const sx = Math.round(imageNode.x() / pps) * pps;
      const sy = Math.round(imageNode.y() / pps) * pps;
      imageNode.position({ x: sx, y: sy });
    });
    imageNode.on('dragend', commitTransform);
    imageLayer.add(imageNode);

    const tr = new Konva.Transformer({
      nodes: [imageNode],
      rotateEnabled: false,
      keepRatio: false,
      anchorSize: 10,
      enabledAnchors: ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center'],
    });
    tr.on('transformend', () => {
      if (!imageNode) return;
      const w = imageNode.width() * imageNode.scaleX();
      const h = imageNode.height() * imageNode.scaleY();
      imageNode.scale({ x: 1, y: 1 });
      imageNode.width(w);
      imageNode.height(h);
      commitTransform();
    });
    imageLayer.add(tr);
  }

  function drawGrid() {
    if (!painting) return;
    const W = painting.canvasW16 * pps;
    const H = painting.canvasH16 * pps;
    if (pps >= 6) {
      for (let i = 0; i <= painting.canvasW16; i++) {
        gridLayer.add(new Konva.Line({ points: [i * pps, 0, i * pps, H], stroke: '#0001', strokeWidth: 1, listening: false }));
      }
      for (let i = 0; i <= painting.canvasH16; i++) {
        gridLayer.add(new Konva.Line({ points: [0, i * pps, W, i * pps], stroke: '#0001', strokeWidth: 1, listening: false }));
      }
    }
    for (let i = 0; i <= painting.canvasW16 / 16; i++) {
      gridLayer.add(new Konva.Line({ points: [i * 16 * pps, 0, i * 16 * pps, H], stroke: '#000a', strokeWidth: 2, listening: false }));
    }
    for (let i = 0; i <= painting.canvasH16 / 16; i++) {
      gridLayer.add(new Konva.Line({ points: [0, i * 16 * pps, W, i * 16 * pps], stroke: '#000a', strokeWidth: 2, listening: false }));
    }
  }

  function commitTransform() {
    if (!painting || !imageNode) return;
    const x16 = Math.max(0, Math.round(imageNode.x() / pps));
    const y16 = Math.max(0, Math.round(imageNode.y() / pps));
    const w16 = Math.max(1, Math.round(imageNode.width() / pps));
    const h16 = Math.max(1, Math.round(imageNode.height() / pps));
    imageNode.position({ x: x16 * pps, y: y16 * pps });
    imageNode.width(w16 * pps);
    imageNode.height(h16 * pps);
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) =>
        p.id === id ? { ...p, transform: { ...p.transform, x16, y16, w16, h16 } } : p),
    }));
  }

  $: if (painting) refresh().catch(console.error);
</script>

<div class="canvas-wrap">
  <div class="canvas-host" bind:this={host}></div>
</div>

<style>
  .canvas-wrap { flex: 1; padding: var(--space-7); background: var(--surface-2); min-height: 0; }
  .canvas-host {
    width: 100%; height: 100%;
    background: #fff; border: 1px solid var(--border); border-radius: var(--radius-lg);
    overflow: hidden;
  }
</style>
```

- [ ] **Step 2: Run existing tests + svelte-check**

Run: `cd web && npm run check && npm test`
Expected: all tests pass, no svelte-check errors. (The Editor toolbar logic has moved to `PaintingProperties.svelte`; the canvas behavior is unchanged.)

- [ ] **Step 3: Commit**

```bash
git add web/src/editor/PaintingEditor.svelte
git commit -m "refactor(editor): strip toolbar from PaintingEditor (moved to PaintingProperties)"
```

---

### Task 10: Topbar

**Files:**
- Create: `web/src/ui/Topbar.svelte`
- Test: `web/src/ui/Topbar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/ui/Topbar.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Topbar from './Topbar.svelte';
import { project } from '../stores/project';
import { packDrawerOpen } from '../stores/ui';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';

describe('Topbar', () => {
  it('disables Build when there are no paintings', () => {
    project.set(createEmptyProject());
    const { getByRole } = render(Topbar);
    const btn = getByRole('button', { name: /Build/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables Build when at least one painting exists', () => {
    const s = createEmptyProject();
    s.paintings.push(createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 }));
    project.set(s);
    const { getByRole } = render(Topbar);
    const btn = getByRole('button', { name: /Build/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('clicking ⚙ flips packDrawerOpen', async () => {
    packDrawerOpen.set(false);
    const { getByRole } = render(Topbar);
    await fireEvent.click(getByRole('button', { name: /Pack settings/ }));
    expect(get(packDrawerOpen)).toBe(true);
  });

  it('clicking Build dispatches a build event', async () => {
    const s = createEmptyProject();
    s.paintings.push(createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 }));
    project.set(s);
    const { getByRole, component } = render(Topbar);
    const fn = vi.fn();
    component.$on('build', fn);
    await fireEvent.click(getByRole('button', { name: /Build/ }));
    expect(fn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/Topbar.test.ts`
Expected: FAIL — cannot find module `./Topbar.svelte`.

- [ ] **Step 3: Create the component**

Create `web/src/ui/Topbar.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { project } from '../stores/project';
  import { packDrawerOpen } from '../stores/ui';
  export let building = false;
  const dispatch = createEventDispatcher<{ build: void; importJSON: void; exportJSON: void }>();
  $: canBuild = $project.paintings.length > 0 && !building;
  function togglePackDrawer() { packDrawerOpen.update((v) => !v); }
</script>

<header class="topbar">
  <span class="brand">
    <span class="brand-dot" aria-hidden="true">🖼</span>
    <span class="brand-name">Painting Maker</span>
  </span>
  <span class="spacer"></span>
  <button type="button" class="ghost desktop-only" on:click={() => dispatch('importJSON')}>Import</button>
  <button type="button" class="ghost desktop-only" on:click={() => dispatch('exportJSON')}>Export</button>
  <button
    type="button" class="icon"
    class:active={$packDrawerOpen}
    aria-label="Pack settings"
    aria-expanded={$packDrawerOpen}
    on:click={togglePackDrawer}
  >⚙</button>
  <button
    type="button" class="build"
    aria-label="Build .mcaddon"
    disabled={!canBuild}
    on:click={() => dispatch('build')}
  >
    {#if building}<span class="spin" aria-hidden="true"></span>Building…
    {:else}<span aria-hidden="true">↓</span> Build<span class="ext desktop-only"> .mcaddon</span>
    {/if}
  </button>
</header>

<style>
  .topbar {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-4) var(--space-7);
    border-bottom: 1px solid var(--border); background: var(--surface);
  }
  .brand { display: flex; align-items: center; gap: var(--space-3); font-weight: 700; font-size: var(--fs-md); color: var(--text); }
  .brand-dot {
    width: 22px; height: 22px; border-radius: var(--radius-sm);
    background: linear-gradient(135deg, var(--primary), var(--text));
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; font-size: 12px;
  }
  .spacer { flex: 1; }
  .ghost {
    padding: 6px 12px; border-radius: var(--radius);
    background: #fff; border: 1px solid var(--border); color: var(--text);
    font-weight: 600; font-size: var(--fs-sm);
  }
  .ghost:hover { background: var(--surface-2); }
  .icon {
    width: 32px; height: 32px; border-radius: var(--radius);
    background: #fff; border: 1px solid var(--border); color: var(--text-muted);
    display: inline-flex; align-items: center; justify-content: center; font-size: 14px;
  }
  .icon:hover { background: var(--surface-2); }
  .icon.active { background: var(--primary-tint); border-color: var(--primary-border); color: var(--primary-deep); }
  .build {
    padding: 7px 14px; border-radius: var(--radius);
    background: var(--cta); border: 1px solid var(--cta-hover); color: #fff;
    font-weight: 600; font-size: var(--fs-sm);
    box-shadow: var(--shadow-sm);
    display: inline-flex; align-items: center; gap: var(--space-2);
  }
  .build:hover:not(:disabled) { background: var(--cta-hover); }
  .build:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
  .spin {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.4); border-top-color: #fff;
    animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 899px) {
    .desktop-only { display: none; }
    .topbar { padding: var(--space-3) var(--space-5); }
  }
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/ui/Topbar.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/Topbar.svelte web/src/ui/Topbar.test.ts
git commit -m "feat(ui): add Topbar with brand, ⚙ and Build CTA"
```

---

### Task 11: PackDrawer

**Files:**
- Create: `web/src/ui/PackDrawer.svelte`
- Test: `web/src/ui/PackDrawer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/ui/PackDrawer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PackDrawer from './PackDrawer.svelte';
import { project } from '../stores/project';
import { packDrawerOpen } from '../stores/ui';
import { createEmptyProject } from '../paintings/defaults';

describe('PackDrawer', () => {
  it('is hidden when packDrawerOpen is false', () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(false);
    const { queryByRole } = render(PackDrawer);
    expect(queryByRole('dialog')).toBeNull();
  });

  it('renders Identity and Advanced sections when open', () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { getByText } = render(PackDrawer);
    expect(getByText('Identity')).toBeTruthy();
    expect(getByText('Advanced')).toBeTruthy();
  });

  it('closes when Escape is pressed', async () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { getByRole } = render(PackDrawer);
    await fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' });
    expect(get(packDrawerOpen)).toBe(false);
  });

  it('closes when the Close button is clicked', async () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { getByRole } = render(PackDrawer);
    await fireEvent.click(getByRole('button', { name: /Close pack settings/ }));
    expect(get(packDrawerOpen)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/PackDrawer.test.ts`
Expected: FAIL — cannot find module `./PackDrawer.svelte`.

- [ ] **Step 3: Create the component**

Create `web/src/ui/PackDrawer.svelte`:

```svelte
<script lang="ts">
  import { project } from '../stores/project';
  import { packDrawerOpen } from '../stores/ui';
  import { z } from 'zod';

  const NamespaceTest = z.string()
    .regex(/^[a-z][a-z0-9_]{0,15}$/)
    .refine((v) => v !== 'minecraft');
  let namespaceError: string | null = null;
  function validateNamespace() {
    const r = NamespaceTest.safeParse($project.pack.namespace);
    namespaceError = r.success ? null : 'Use lowercase a-z, 0-9, _ (max 16 chars), not "minecraft".';
  }

  function close() { packDrawerOpen.set(false); }
  function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') close(); }

  async function onPackIconPicked(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const b64 = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const v = String(fr.result);
        const idx = v.indexOf(',');
        resolve(idx >= 0 ? v.slice(idx + 1) : v);
      };
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(f);
    });
    project.update((s) => ({ ...s, pack: { ...s.pack, iconPngBase64: b64 } }));
  }
  function clearPackIcon() {
    project.update((s) => ({ ...s, pack: { ...s.pack, iconPngBase64: null } }));
  }
</script>

{#if $packDrawerOpen}
  <div
    class="shade"
    on:click={close}
    on:keydown={onKeyDown}
    role="presentation"
  ></div>
  <aside
    class="drawer"
    role="dialog" aria-modal="true" aria-labelledby="pack-drawer-title"
    on:keydown={onKeyDown}
    tabindex="-1"
  >
    <header class="head">
      <h2 id="pack-drawer-title">Pack settings</h2>
      <button type="button" class="close" aria-label="Close pack settings" on:click={close}>✕</button>
    </header>

    <section>
      <h4 class="section-title">Identity</h4>
      <label class="stack">
        <span class="field-label">Pack name</span>
        <span class="field-hint">Shown in the in-game pack list.</span>
        <input class="field" bind:value={$project.pack.name} />
      </label>
      <label class="stack">
        <span class="field-label">Description</span>
        <input class="field" bind:value={$project.pack.description} />
      </label>
      <span class="field-label">Pack icon</span>
      <div class="icon-pick">
        <div class="preview">
          {#if $project.pack.iconPngBase64}
            <img src={`data:image/png;base64,${$project.pack.iconPngBase64}`} alt="pack icon preview" />
          {/if}
        </div>
        <label class="pick">
          <span>Change…</span>
          <input type="file" accept="image/png" on:change={onPackIconPicked} hidden />
        </label>
        {#if $project.pack.iconPngBase64}
          <button type="button" class="link" on:click={clearPackIcon}>Clear</button>
        {/if}
      </div>
    </section>

    <section>
      <h4 class="section-title">Advanced</h4>
      <label class="stack">
        <span class="field-label">Namespace</span>
        <span class="field-hint">Lowercase, used internally. Don't change after publishing.</span>
        <input class="field" class:invalid={namespaceError !== null}
          bind:value={$project.pack.namespace} on:blur={validateNamespace} />
        {#if namespaceError}<span class="err">{namespaceError}</span>{/if}
      </label>
      <label class="stack">
        <span class="field-label">Creative menu group</span>
        <input class="field" bind:value={$project.pack.creativeGroupName} />
      </label>
      <span class="field-label">Version</span>
      <div class="row3">
        <input class="field" type="number" min="0" bind:value={$project.pack.semver[0]} aria-label="Major version" />
        <input class="field" type="number" min="0" bind:value={$project.pack.semver[1]} aria-label="Minor version" />
        <input class="field" type="number" min="0" bind:value={$project.pack.semver[2]} aria-label="Patch version" />
      </div>
    </section>
  </aside>
{/if}

<style>
  .shade {
    position: fixed; inset: 0; background: rgba(15,23,42,.4);
    backdrop-filter: blur(2px); z-index: 10;
  }
  .drawer {
    position: fixed; right: 0; top: 0; bottom: 0; width: 380px;
    background: var(--bg); border-left: 1px solid var(--border);
    box-shadow: var(--shadow-lg); padding: var(--space-8);
    overflow: auto; z-index: 11; outline: none;
    display: flex; flex-direction: column; gap: var(--space-7);
  }
  .head { display: flex; align-items: center; gap: var(--space-3); margin-bottom: 0; }
  .head h2 { font-size: var(--fs-lg); font-weight: 700; margin: 0; flex: 1; }
  .close {
    width: 28px; height: 28px; border-radius: var(--radius-sm);
    background: var(--surface-2); color: var(--text-muted);
    display: inline-flex; align-items: center; justify-content: center;
  }
  .close:hover { background: var(--surface); }
  section { display: flex; flex-direction: column; gap: var(--space-3); }
  .stack { display: flex; flex-direction: column; gap: var(--space-1); }
  .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-2); }
  .icon-pick {
    display: flex; align-items: center; gap: var(--space-4);
    padding: var(--space-3); border: 1px dashed var(--border-strong); border-radius: var(--radius-lg);
  }
  .preview {
    width: 48px; height: 48px; border-radius: var(--radius);
    background: var(--surface-2); overflow: hidden;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .preview img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
  .pick { font-size: var(--fs-xs); font-weight: 600; color: var(--primary); cursor: pointer; }
  .link { font-size: var(--fs-xs); color: var(--text-muted); text-decoration: underline; }
  .err { font-size: var(--fs-xs); color: var(--danger); }

  @media (max-width: 899px) {
    .drawer { width: 100%; padding: var(--space-6); }
  }
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/ui/PackDrawer.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/PackDrawer.svelte web/src/ui/PackDrawer.test.ts
git commit -m "feat(ui): add PackDrawer to replace PackSettings"
```

---

### Task 12: TabBar (mobile)

**Files:**
- Create: `web/src/ui/TabBar.svelte`

- [ ] **Step 1: Create the component**

Create `web/src/ui/TabBar.svelte`:

```svelte
<script lang="ts">
  import { activeTab, type Tab } from '../stores/ui';
  type TabDef = { id: Tab; icon: string; label: string };
  const tabs: TabDef[] = [
    { id: 'paintings', icon: '🖼', label: 'Paintings' },
    { id: 'edit',      icon: '✎', label: 'Edit' },
    { id: 'properties',icon: '≡', label: 'Properties' },
  ];
</script>

<nav class="tabbar" role="tablist" aria-label="Main sections">
  {#each tabs as t}
    <button
      type="button" role="tab"
      class:on={$activeTab === t.id}
      aria-selected={$activeTab === t.id}
      aria-controls={`tabpanel-${t.id}`}
      on:click={() => activeTab.set(t.id)}
    >
      <span class="ic" aria-hidden="true">{t.icon}</span>
      <span class="lbl">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tabbar {
    display: flex; border-top: 1px solid var(--border); background: var(--surface);
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  button {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: var(--space-3) var(--space-1); color: var(--text-muted);
    font-size: 9px; font-weight: 600;
  }
  button.on { color: var(--primary); }
  .ic { font-size: 16px; line-height: 1; }
  @media (min-width: 900px) { .tabbar { display: none; } }
</style>
```

- [ ] **Step 2: Verify svelte-check passes**

Run: `cd web && npm run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/ui/TabBar.svelte
git commit -m "feat(ui): add mobile TabBar"
```

---

### Task 13: Rewire App.svelte (responsive shell)

**Files:**
- Modify: `web/src/App.svelte`
- Delete: `web/src/ui/PackSettings.svelte`

- [ ] **Step 1: Rewrite App.svelte**

Replace the entire contents of `web/src/App.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { project } from './stores/project';
  import { bindPersistence, loadFromStorage, importProjectJSON, exportProjectJSON } from './stores/persistence';
  import { activeTab } from './stores/ui';
  import Topbar from './ui/Topbar.svelte';
  import Sidebar from './ui/Sidebar.svelte';
  import PaintingEditor from './editor/PaintingEditor.svelte';
  import EditorHeader from './ui/EditorHeader.svelte';
  import PaintingProperties from './ui/PaintingProperties.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import PackDrawer from './ui/PackDrawer.svelte';
  import TabBar from './ui/TabBar.svelte';
  import { buildMcaddonBlob, archiveFilename } from './mcpack/build';

  let selectedId: string | null = null;
  let building = false;
  let toast: string | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let importInput: HTMLInputElement;

  onMount(() => {
    const saved = loadFromStorage();
    if (saved) project.set(saved);
    if (selectedId === null && $project.paintings.length > 0) selectedId = $project.paintings[0].id;
    return bindPersistence(project, 1000);
  });

  $: if (selectedId && !$project.paintings.find((p) => p.id === selectedId)) selectedId = null;
  $: if (selectedId === null && $project.paintings.length > 0) selectedId = $project.paintings[0].id;

  function showToast(msg: string) {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 6000);
  }

  async function onBuild() {
    building = true;
    try {
      const blob = await buildMcaddonBlob($project);
      downloadBlob(blob, archiveFilename($project));
    } catch (err) {
      showToast(`Build failed: ${(err as Error).message}`);
    } finally {
      building = false;
    }
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function onExport() {
    downloadBlob(new Blob([exportProjectJSON($project)], { type: 'application/json' }),
      `${$project.pack.name || 'project'}-project.json`);
  }
  function onImport() { importInput?.click(); }
  async function onImportFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try { project.set(importProjectJSON(await f.text())); }
    catch (err) { showToast(`Import failed: ${(err as Error).message}`); }
  }

  function selectFromList(id: string) {
    selectedId = id;
    activeTab.set('edit');
  }
</script>

<div class="app">
  <Topbar {building} on:build={onBuild} on:exportJSON={onExport} on:importJSON={onImport} />
  <input type="file" accept="application/json" hidden bind:this={importInput} on:change={onImportFile} />

  <div class="body">
    <aside class="col sidebar-col" data-active={$activeTab === 'paintings'}>
      <Sidebar bind:selectedId on:select={(e) => selectFromList(e.detail)} />
    </aside>

    <main class="col editor-col" data-active={$activeTab === 'edit'} id="tabpanel-edit">
      {#if selectedId}
        <EditorHeader id={selectedId} />
        {#key selectedId}
          <PaintingEditor id={selectedId} />
        {/key}
      {:else}
        <EmptyState />
      {/if}
    </main>

    <aside class="col props-col" data-active={$activeTab === 'properties'} id="tabpanel-properties">
      {#if selectedId}
        <PaintingProperties id={selectedId} />
      {:else}
        <EmptyState
          title="No painting selected"
          body="Add an image or pick one from the list to edit its properties."
        />
      {/if}
    </aside>
  </div>

  <TabBar />
  <PackDrawer />

  {#if toast}
    <div class="toast" role="alert">{toast}</div>
  {/if}
</div>

<style>
  .app { height: 100vh; display: flex; flex-direction: column; }
  .body { flex: 1; display: grid; grid-template-columns: 240px 1fr 280px; min-height: 0; }
  .col { min-height: 0; overflow: auto; }
  .sidebar-col { background: var(--surface); border-right: 1px solid var(--border); }
  .editor-col  { display: flex; flex-direction: column; background: var(--bg); }
  .props-col   { background: var(--surface); border-left: 1px solid var(--border); }

  .toast {
    position: fixed; right: var(--space-7); bottom: var(--space-7);
    background: #fff; border: 1px solid var(--danger); color: var(--danger);
    padding: var(--space-4) var(--space-5); border-radius: var(--radius);
    box-shadow: var(--shadow); font-size: var(--fs-sm); max-width: 340px;
    z-index: 20;
  }

  @media (max-width: 899px) {
    .body { display: block; position: relative; }
    .col { display: none; height: 100%; }
    .col[data-active="true"] { display: flex; flex-direction: column; }
    .editor-col[data-active="true"] { display: flex; }
    .props-col[data-active="true"] { display: block; overflow: auto; }
  }
</style>
```

- [ ] **Step 2: Delete PackSettings.svelte**

```bash
git rm web/src/ui/PackSettings.svelte
```

- [ ] **Step 3: Verify the full app builds and tests pass**

Run: `cd web && npm run check && npm test && npm run build`
Expected: no svelte-check errors, all tests pass, build succeeds.

- [ ] **Step 4: Manual smoke test in dev server**

Run: `cd web && npm run dev` (background) and open the printed URL.

Verify in the browser (golden path + key edge cases):
- Empty state shown with the FileDrop card on first load.
- Drag a PNG in → painting is selected automatically → editor shows canvas + properties panel on the right.
- Click painting name in the editor → input appears → type new name → Enter commits → blur also commits → Escape reverts.
- Properties pills: clicking "Pixel art" / "Cutout" / "Blended" / "Smooth" updates the painting (no console errors, image renders accordingly).
- Click ⚙ in topbar → drawer slides in → Escape closes; click outside (shade) closes; close button closes.
- Build button disabled while paintings empty; enabled after adding one; "Building…" with spinner during build; downloaded `.mcaddon` opens normally.
- Resize the window below 900px → tab bar appears at bottom, columns become a single visible pane per tab; tapping a painting in the Paintings tab switches to the Edit tab.

If any of these fail, fix in this task before moving on.

- [ ] **Step 5: Commit**

```bash
git add web/src/App.svelte
git add -u web/src/ui/PackSettings.svelte
git commit -m "feat(ui): wire new shell — Topbar + responsive 3-col / mobile tabs + PackDrawer"
```

---

## Final integration check

After Task 13:

- [ ] `cd web && npm run check && npm test && npm run build` — all green
- [ ] `git status` — clean working tree
- [ ] Spot-check `git log --oneline` shows one commit per task

---

## Self-review (controller's checklist, done before handoff)

**Spec coverage:**
- Palette / typography / spacing tokens → Task 1 ✓
- 3-column desktop layout → Task 13 ✓
- Topbar with brand + Import/Export + ⚙ + Build → Task 10 ✓
- Sidebar with AddCard + PaintingList, no inline rename → Tasks 4–6 ✓
- EditorHeader click-to-rename → Task 7 ✓
- PaintingProperties with friendly labels (Cutout/Blended, Smooth/Pixel art) → Task 8 ✓
- PaintingEditor stripped to canvas only → Task 9 ✓
- PackDrawer replaces PackSettings → Task 11 + Task 13 deletion ✓
- TabBar for mobile → Task 12 ✓
- Mobile <900px breakpoint → Tasks 10, 11, 12, 13 (all `@media` rules) ✓
- EmptyState card → Task 3, used in Task 13 ✓
- Build button states (idle/disabled/building) + error toast → Tasks 10 + 13 ✓
- A11y: `role="dialog"`, `role="radiogroup"`, `role="tablist"`, focus styles → Tasks 1, 8, 11, 12 ✓

**Placeholders:** none found — every step has concrete code or a concrete command.

**Type consistency:**
- `Tab` type defined in Task 2, consumed in Tasks 10 & 12 ✓
- `Painting` fields (`canvasW16`, `canvasH16`, `material`, `resampling`, `textureDensity`, `transform`) used consistently across Tasks 5, 7, 8, 9 (matching `web/src/paintings/types.ts`) ✓
- Component event names (`select`, `remove`, `build`, `importJSON`, `exportJSON`) consistent between dispatch and listeners ✓
- `packDrawerOpen` store consumed in Tasks 10, 11, 13 ✓

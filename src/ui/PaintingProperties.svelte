<script lang="ts">
  import { onDestroy } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { project } from '../stores/project';
  import { devMode } from '../stores/devMode';
  import { resolveDensity } from '../paintings/density';
  import { applyPaintingPatch } from '../paintings/painting';
  import type { Painting, Density } from '../paintings/types';
  export let id: string;
  $: painting = $project.paintings.find((p) => p.id === id) ?? null;
  $: density = painting ? resolveDensity(painting) : 1;

  function patch(update: Partial<Painting>) {
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? applyPaintingPatch(p, update) : p),
    }));
  }
  // Bypasses applyPaintingPatch (and its slug-regeneration logic) so debug
  // edits to id / slugVersion land verbatim.
  function rawPatch(update: Partial<Painting>) {
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? { ...p, ...update } : p),
    }));
  }
  function setRawId(e: Event) {
    rawPatch({ id: (e.currentTarget as HTMLInputElement).value });
  }
  function regenRawId() {
    rawPatch({ id: uuidv4() });
  }
  function setSlugVersion(e: Event) {
    const n = (e.currentTarget as HTMLInputElement).valueAsNumber;
    if (!Number.isFinite(n)) return;
    rawPatch({ slugVersion: n });
  }
  function toggleLock() {
    if (!painting) return;
    patch({ slugLocked: !painting.slugLocked });
  }
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
  let copied = false;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  let slugInputEl: HTMLInputElement | null = null;
  async function copyInGameId() {
    if (!painting) return;
    const text = `${$project.pack.namespace}:${painting.slug}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: select the input so the user can press Ctrl+C.
      slugInputEl?.select();
      return;
    }
    copied = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copied = false; }, 1500);
  }
  onDestroy(() => { if (copyTimer) clearTimeout(copyTimer); });
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
        <span class="field-hint">Pixels per 1/16-block - higher means more detail.</span>
        <select class="field"
          value={painting.textureDensity}
          on:change={(e) => patch({ textureDensity: parseDensity(e.currentTarget.value) })}>
          <option value="auto">Auto · {density}× · {painting.canvasW16 * density}×{painting.canvasH16 * density} px</option>
          {#each [1,2,4,8,16,32,64] as n}<option value={n}>{n}× · {painting.canvasW16 * n}×{painting.canvasH16 * n} px</option>{/each}
        </select>
      </label>

      <div class="stack">
        <span class="field-label">Scaling</span>
        <span class="pills" role="radiogroup" aria-label="Scaling">
          <button type="button" role="radio"
            aria-checked={painting.resampling === 'smooth'}
            class:on={painting.resampling === 'smooth'}
            on:click={() => patch({ resampling: 'smooth' })}>Smooth</button>
          <button type="button" role="radio"
            aria-checked={painting.resampling === 'pixelated'}
            class:on={painting.resampling === 'pixelated'}
            on:click={() => patch({ resampling: 'pixelated' })}>Pixel art</button>
        </span>
      </div>
    </section>

    <section>
      <h4 class="section-title">Transparency</h4>
      <span class="pills" role="radiogroup" aria-label="Transparency">
        <button type="button" role="radio"
          aria-checked={painting.material === 'alphatest'}
          class:on={painting.material === 'alphatest'}
          on:click={() => patch({ material: 'alphatest' })}>Cutout</button>
        <button type="button" role="radio"
          aria-checked={painting.material === 'alphablend'}
          class:on={painting.material === 'alphablend'}
          on:click={() => patch({ material: 'alphablend' })}>Blended</button>
      </span>
      <p class="field-hint" style="margin-top: var(--space-2)">
        Cutout: pixels are either fully visible or fully invisible - fits most images.
        Blended: supports partial transparency throughout the texture (glass, gradients, smoky effects).
      </p>
    </section>

    <section>
      <h4 class="section-title">In-game ID</h4>
      <span class="id-prefix">{$project.pack.namespace}:</span>
      <input class="field id-slug"
        class:invalid={slugError !== null}
        aria-label="In-game slug"
        bind:this={slugInputEl}
        value={slugDraft}
        on:input={onSlugInput}
        on:blur={onSlugBlur} />
      {#if slugError}<span class="err">{slugError}</span>{/if}
      <div class="id-actions">
        <button type="button" class="id-btn id-lock"
          aria-label={painting.slugLocked ? 'Unlock slug' : 'Lock slug'}
          aria-pressed={painting.slugLocked}
          on:click={toggleLock}>
          {#if painting.slugLocked}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
            </svg>
          {/if}
        </button>
        <button type="button" class="id-btn"
          aria-label="Copy in-game ID"
          on:click={copyInGameId}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p class="field-hint">
        Used to summon this painting in-game (for example, with the /summon command).
      </p>
      <p class="field-hint">
        {#if painting.slugLocked}
          Custom value. Click the lock icon to resume auto-update from the painting name.
        {:else}
          Auto-updates with the painting name. Lock to keep the current value when renaming.
        {/if}
      </p>
    </section>

    {#if $devMode}
      <section class="debug-section">
        <h4 class="section-title">Debug · Painting state</h4>
        <p class="field-hint">
          Raw values from the saved painting. Edits skip the usual safeguards.
        </p>
        <label class="stack">
          <span class="field-label">Internal id</span>
          <span class="uuid-row">
            <input class="field uuid-input"
              value={painting.id}
              on:input={setRawId}
              aria-label="Internal painting id" />
            <button type="button" class="uuid-regen"
              on:click={regenRawId}
              aria-label="Regenerate internal id">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </span>
        </label>
        <label class="stack">
          <span class="field-label">Slug algorithm version</span>
          <input class="field" type="number" min="0" step="1"
            value={painting.slugVersion}
            on:input={setSlugVersion}
            aria-label="Slug algorithm version" />
        </label>
      </section>
    {/if}
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
  .id-prefix {
    display: block; font-size: var(--fs-xs); color: var(--text-muted);
    font-family: monospace; margin-bottom: var(--space-1);
  }
  .id-slug { width: 100%; font-family: monospace; }
  .id-btn {
    padding: 5px var(--space-3); font-size: var(--fs-xs); font-weight: 600;
    color: var(--text-muted); border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm); background: #fff;
  }
  .id-btn:hover { background: var(--surface); }
  .id-lock { display: inline-flex; align-items: center; justify-content: center; }
  .id-actions {
    display: flex; gap: var(--space-2); justify-content: flex-end;
    margin-top: var(--space-2);
  }
  .id-slug.invalid { border-color: var(--danger, #c00); }
  .err {
    display: block; margin-top: var(--space-1);
    font-size: var(--fs-xs); color: var(--danger, #c00);
  }
  .debug-section {
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--cta);
    border-radius: var(--radius);
    background: #fff7ed;
  }
  .debug-section .section-title { color: var(--cta); }
  .debug-section .section-title::before { background: var(--cta); }
  .uuid-row {
    display: flex; align-items: stretch; gap: var(--space-2);
  }
  .uuid-input {
    flex: 1; min-width: 0;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: var(--fs-xs);
  }
  .uuid-regen {
    width: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    background: #fff; border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
    color: var(--text-muted);
  }
  .uuid-regen:hover { background: var(--surface-2); color: var(--cta-hover); }
</style>

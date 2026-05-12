<script lang="ts">
  import { onDestroy } from 'svelte';
  import { project } from '../stores/project';
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
  function toggleLock() {
    if (!painting) return;
    patch({ slugLocked: !painting.slugLocked });
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
      <div class="id-row">
        <span class="id-prefix">{$project.pack.namespace}:</span>
        <input class="field id-slug"
          aria-label="In-game slug"
          bind:this={slugInputEl}
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
      <p class="field-hint">
        {#if painting.slugLocked}
          Custom value. Click the lock icon to resume auto-update from the painting name.
        {:else}
          Auto-updates with the painting name. Lock to keep the current value when renaming.
        {/if}
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
  .id-lock { font-size: var(--fs-sm); }
</style>

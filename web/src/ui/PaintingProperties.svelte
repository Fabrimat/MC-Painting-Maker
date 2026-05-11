<script lang="ts">
  import { project } from '../stores/project';
  import { resolveDensity } from '../paintings/density';
  import type { Painting, Density } from '../paintings/types';
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

<script lang="ts">
  export let zoom: number;
  export let minZoom: number;
  export let maxZoom: number;
  export let onZoomIn: () => void;
  export let onZoomOut: () => void;
  export let onSetZoom: (z: number) => void;
  export let onFit: () => void;
  export let onResetOneToOne: () => void;

  const PRESETS = [0.25, 0.5, 0.75, 1, 2, 4, 8];

  let menuOpen = false;
  $: pct = Math.round(zoom * 100);
  $: canZoomIn = zoom < maxZoom - 1e-6;
  $: canZoomOut = zoom > minZoom + 1e-6;
  $: availablePresets = PRESETS.filter((z) => z >= minZoom - 1e-6 && z <= maxZoom + 1e-6);

  function toggleMenu() { menuOpen = !menuOpen; }
  function pick(z: number) { menuOpen = false; onSetZoom(z); }
  function onMenuKey(e: KeyboardEvent) { if (e.key === 'Escape') menuOpen = false; }
</script>

<div class="toolbar" role="toolbar" aria-label="Canvas controls">
  <button type="button" class="btn" disabled={!canZoomOut} on:click={onZoomOut} title="Zoom out (-)">−</button>

  <div class="zoom-display">
    <button type="button" class="pct" on:click={toggleMenu} aria-haspopup="menu" aria-expanded={menuOpen} title="Zoom presets">
      {pct}% <span aria-hidden="true">▾</span>
    </button>
    {#if menuOpen}
      <ul class="menu" role="menu" on:keydown={onMenuKey}>
        {#each availablePresets as p}
          <li role="menuitem">
            <button type="button" class="preset" on:click={() => pick(p)}>{Math.round(p * 100)}%</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <button type="button" class="btn" disabled={!canZoomIn} on:click={onZoomIn} title="Zoom in (+)">+</button>

  <span class="sep" aria-hidden="true"></span>

  <button type="button" class="btn label" on:click={onFit} title="Fit to screen (0)">
    <span class="icon" aria-hidden="true">⛶</span><span class="text">Fit</span>
  </button>
  <button type="button" class="btn label" on:click={onResetOneToOne} title="Actual size (1)">
    <span class="text">1:1</span>
  </button>
</div>

<style>
  .toolbar {
    position: absolute;
    right: var(--space-5);
    bottom: var(--space-5);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    z-index: 10;
    user-select: none;
  }
  .btn {
    min-width: 32px; height: 32px;
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text);
    font-size: var(--fs-md);
    line-height: 1;
    cursor: pointer;
  }
  .btn:hover:not(:disabled) { background: var(--surface); border-color: var(--border); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .label { display: inline-flex; align-items: center; gap: var(--space-2); }
  .icon { font-size: var(--fs-lg); }
  .sep { width: 1px; height: 20px; background: var(--border); margin: 0 var(--space-1); }
  .zoom-display { position: relative; }
  .pct {
    min-width: 64px; height: 32px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    font-size: var(--fs-sm);
    cursor: pointer;
  }
  .pct:hover { background: #fff; }
  .menu {
    position: absolute; right: 0; bottom: calc(100% + 4px);
    list-style: none; margin: 0; padding: var(--space-1);
    background: #fff; border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow); min-width: 88px;
  }
  .preset {
    width: 100%; text-align: right; padding: 4px 8px;
    border: 0; background: transparent; border-radius: var(--radius-sm);
    font-size: var(--fs-sm); cursor: pointer;
  }
  .preset:hover { background: var(--surface); }
  @media (max-width: 480px) {
    .label .text { display: none; }
  }
</style>

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

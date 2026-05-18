<script lang="ts">
  import { project } from '../stores/project';
  import { packDrawerOpen } from '../stores/ui';
  export let building = false;
  export let onbuild: () => void = () => {};
  $: canBuild = $project.paintings.length > 0 && !building;
  function togglePackDrawer() { packDrawerOpen.update((v) => !v); }
</script>

<header class="topbar">
  <span class="brand">
    <svg class="brand-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <g transform="rotate(-45 16 16)">
        <path d="M13 11 L3 7 L3 25 L13 21 Z" fill="#374151"/>
        <path d="M3 13 C 0 14, 0 18, 3 19 Z" fill="#f97316"/>
        <rect x="11" y="10" width="6" height="12" rx="1" fill="#9ca3af"/>
        <rect x="11" y="19.5" width="6" height="2.5" rx="1" fill="#6b7280"/>
        <rect x="16" y="12" width="14" height="8" rx="2" fill="#a16842"/>
        <rect x="25.5" y="12.5" width="4.5" height="7" rx="2" fill="#7d4f30"/>
      </g>
    </svg>
    <span class="brand-name">Painting Maker</span>
  </span>
  <span class="spacer"></span>
  <a class="howto" href="./how-to.html">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" x2="12.01" y1="17" y2="17"/>
    </svg>
    <span class="desktop-only">How to use</span>
  </a>
  <button
    type="button" class="icon"
    class:active={$packDrawerOpen}
    aria-label="Pack settings"
    aria-expanded={$packDrawerOpen}
    on:click={togglePackDrawer}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </button>
  <button
    type="button" class="build"
    aria-label="Build .mcaddon"
    disabled={!canBuild}
    on:click={onbuild}
  >
    {#if building}<span class="spin" aria-hidden="true"></span>Building…
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" x2="12" y1="15" y2="3"/>
      </svg>
      Build<span class="ext desktop-only"> .mcaddon</span>
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
  .brand-icon { width: 24px; height: 24px; display: block; }
  .spacer { flex: 1; }
  .howto {
    display: inline-flex; align-items: center; gap: var(--space-2);
    padding: 6px 10px; border-radius: var(--radius);
    color: var(--text-muted); text-decoration: none;
    font-weight: 500; font-size: var(--fs-sm);
  }
  .howto:hover { color: var(--text); background: var(--surface-2); }
  .howto svg { display: block; }
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

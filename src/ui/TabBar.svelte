<script lang="ts">
  import { activeTab, type Tab } from '../stores/ui';
  type TabDef = { id: Tab; label: string };
  const tabs: TabDef[] = [
    { id: 'paintings', label: 'Paintings' },
    { id: 'edit',      label: 'Edit' },
    { id: 'properties',label: 'Properties' },
  ];
</script>

<div class="tabbar" role="tablist" aria-label="Main sections">
  {#each tabs as t}
    <button
      type="button" role="tab"
      class:on={$activeTab === t.id}
      aria-selected={$activeTab === t.id}
      aria-controls={`tabpanel-${t.id}`}
      on:click={() => activeTab.set(t.id)}
    >
      <span class="ic" aria-hidden="true">
        {#if t.id === 'paintings'}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        {:else if t.id === 'edit'}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
            <path d="m15 5 4 4"/>
          </svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="21" x2="14" y1="4" y2="4"/>
            <line x1="10" x2="3" y1="4" y2="4"/>
            <line x1="21" x2="12" y1="12" y2="12"/>
            <line x1="8" x2="3" y1="12" y2="12"/>
            <line x1="21" x2="16" y1="20" y2="20"/>
            <line x1="12" x2="3" y1="20" y2="20"/>
            <line x1="14" x2="14" y1="2" y2="6"/>
            <line x1="8" x2="8" y1="10" y2="14"/>
            <line x1="16" x2="16" y1="18" y2="22"/>
          </svg>
        {/if}
      </span>
      <span class="lbl">{t.label}</span>
    </button>
  {/each}
</div>

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
  .ic { display: inline-flex; line-height: 1; }
  .ic svg { display: block; }
  @media (min-width: 900px) { .tabbar { display: none; } }
</style>

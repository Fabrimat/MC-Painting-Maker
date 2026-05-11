<script lang="ts">
  import { activeTab, type Tab } from '../stores/ui';
  type TabDef = { id: Tab; icon: string; label: string };
  const tabs: TabDef[] = [
    { id: 'paintings', icon: '🖼', label: 'Paintings' },
    { id: 'edit',      icon: '✎', label: 'Edit' },
    { id: 'properties',icon: '≡', label: 'Properties' },
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
      <span class="ic" aria-hidden="true">{t.icon}</span>
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
  .ic { font-size: 16px; line-height: 1; }
  @media (min-width: 900px) { .tabbar { display: none; } }
</style>

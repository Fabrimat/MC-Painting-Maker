<script lang="ts">
  import { needRefresh, applyUpdate } from '../pwa/register';
</script>

{#if $needRefresh}
  <div class="update-toast" role="status" aria-live="polite">
    <span class="msg">Nuova versione disponibile</span>
    <button type="button" class="reload" on:click={applyUpdate}>Ricarica</button>
  </div>
{/if}

<style>
  .update-toast {
    position: fixed; left: var(--space-7); bottom: var(--space-7);
    background: #fff; border: 1px solid var(--primary-border); color: var(--text);
    padding: var(--space-4) var(--space-5); border-radius: var(--radius);
    box-shadow: var(--shadow); font-size: var(--fs-sm); max-width: 340px;
    display: flex; align-items: center; gap: var(--space-4);
    z-index: 20;
  }
  .reload {
    padding: 6px 12px; border-radius: var(--radius);
    background: var(--cta); border: 1px solid var(--cta-hover); color: #fff;
    font-weight: 600; font-size: var(--fs-sm);
    box-shadow: var(--shadow-sm);
  }
  .reload:hover { background: var(--cta-hover); }
</style>

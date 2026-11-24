<script lang="ts">
  // One-off "what's new" banner. Bump NEWS_ID when the message changes so
  // users who dismissed the previous one see the new one.
  const NEWS_ID = 'floor-ceiling-placement';
  const KEY = 'mc-painting-maker:news-dismissed';

  function wasDismissed(): boolean {
    try {
      return localStorage.getItem(KEY) === NEWS_ID;
    } catch {
      return false;
    }
  }

  let visible = !wasDismissed();

  function dismiss() {
    visible = false;
    try {
      localStorage.setItem(KEY, NEWS_ID);
    } catch {
      // Storage unavailable (private mode): hidden for this session only.
    }
  }
</script>

{#if visible}
  <div class="news-banner" role="status">
    <span>Paintings can now be placed on floors and ceilings too, try them out!</span>
    <button type="button" class="news-close" aria-label="Dismiss" on:click={dismiss}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
      </svg>
    </button>
  </div>
{/if}

<style>
  .news-banner {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-2) var(--space-7);
    background: var(--primary-tint); color: var(--primary-deep);
    border-top: 1px solid var(--primary-border);
    font-size: var(--fs-sm);
  }
  .news-banner span { flex: 1; }
  .news-close {
    display: inline-flex; padding: 4px; border-radius: var(--radius-sm);
    color: var(--primary-deep);
  }
  .news-close:hover { background: var(--primary-border); }
</style>

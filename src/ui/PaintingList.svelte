<script lang="ts">
  import type { Painting } from '../paintings/types';

  export let paintings: Painting[] = [];
  export let selectedId: string | null = null;
  export let onselect: (id: string) => void = () => {};
  export let onremove: (id: string) => void = () => {};

  function sizeLabel(p: Painting) {
    return `${(p.canvasW16 / 16).toFixed(2)} × ${(p.canvasH16 / 16).toFixed(2)} blocks`;
  }
</script>

<ul>
  {#each paintings as p (p.id)}
    <li class:sel={selectedId === p.id}>
      <button
        type="button"
        class="row"
        aria-label={`Select ${p.name}`}
        aria-pressed={selectedId === p.id}
        on:click={() => onselect(p.id)}
      >
        <span class="thumb">
          {#if p.source}
            <img src={`data:image/png;base64,${p.source.pngBase64}`} alt="" />
          {/if}
        </span>
        <span class="meta">
          <span class="name">{p.name}</span>
          <span class="size">{sizeLabel(p)}</span>
        </span>
      </button>
      <button
        type="button"
        class="p-del"
        aria-label={`Delete ${p.name}`}
        on:click|stopPropagation={() => onremove(p.id)}
      >
        ✕
      </button>
    </li>
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    display: flex;
    align-items: center;
    border-radius: var(--radius);
    margin-bottom: var(--space-1);
  }

  li:hover {
    background: var(--surface);
  }

  li.sel {
    background: var(--primary-tint);
    box-shadow: inset 0 0 0 1px var(--primary-border);
  }

  .row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    min-width: 0;
    text-align: left;
  }

  .thumb {
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .size {
    font-size: var(--fs-xs);
    color: var(--text-muted);
  }

  .p-del {
    width: 26px;
    height: 26px;
    margin-right: var(--space-2);
    color: var(--text-faint);
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: opacity 0.12s, background 0.12s, color 0.12s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  li:hover .p-del,
  li.sel .p-del {
    opacity: 1;
  }

  .p-del:hover {
    background: var(--danger-tint);
    color: var(--danger);
  }
</style>

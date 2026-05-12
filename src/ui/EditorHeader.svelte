<script lang="ts">
  import { project } from '../stores/project';
  import { applyPaintingPatch } from '../paintings/painting';
  export let id: string;
  let editing = false;
  let draft = '';
  $: painting = $project.paintings.find((p) => p.id === id) ?? null;

  function startEditing() {
    if (!painting) return;
    draft = painting.name;
    editing = true;
  }
  function commit() {
    const name = draft.trim();
    if (!name) { cancel(); return; }
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? applyPaintingPatch(p, { name }) : p),
    }));
    editing = false;
  }
  function cancel() { editing = false; }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') cancel();
  }
  function autofocus(node: HTMLInputElement) { node.focus(); node.select(); }
</script>

{#if painting}
  <header class="editor-header">
    {#if editing}
      <input
        class="title-input"
        type="text"
        bind:value={draft}
        on:keydown={onKeyDown}
        on:blur={commit}
        use:autofocus
        aria-label="Painting name"
      />
    {:else}
      <button type="button" class="title" on:click={startEditing}>{painting.name}</button>
      <span class="hint">· click to rename</span>
    {/if}
  </header>
{/if}

<style>
  .editor-header {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-5) var(--space-7);
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .title {
    font-size: var(--fs-lg); font-weight: 700; color: var(--text);
    padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid transparent;
  }
  .title:hover { border-color: var(--border); background: var(--surface); }
  .title-input {
    font-size: var(--fs-lg); font-weight: 700; color: var(--text);
    padding: 2px 6px; border-radius: var(--radius-sm);
    border: 1px solid var(--primary); outline: 3px solid var(--primary-tint);
    background: #fff;
  }
  .hint { font-size: var(--fs-sm); color: var(--text-muted); }
</style>

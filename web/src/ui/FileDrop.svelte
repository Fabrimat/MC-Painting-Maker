<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ files: FileList }>();
  let dragOver = false;

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer?.files?.length) dispatch('files', e.dataTransfer.files);
  }
  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.length) dispatch('files', t.files);
    t.value = '';
  }
</script>

<label
  class="add-card" class:over={dragOver}
  on:dragover|preventDefault={() => (dragOver = true)}
  on:dragleave={() => (dragOver = false)}
  on:drop={onDrop}
>
  <span class="plus" aria-hidden="true">+</span>
  <span class="label">
    <span class="title">Add images</span>
    <small>drag &amp; drop or click</small>
  </span>
  <input type="file" multiple accept="image/png,image/jpeg" on:change={onPick} hidden />
</label>

<style>
  .add-card {
    display: flex; align-items: center; gap: var(--space-4);
    padding: var(--space-5); border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-lg); background: var(--bg);
    color: var(--text-muted); cursor: pointer; user-select: none;
    transition: border-color .12s, background .12s;
  }
  .add-card:hover, .add-card.over {
    border-color: var(--primary); background: var(--primary-tint);
  }
  .plus {
    width: 32px; height: 32px; flex: 0 0 auto;
    border-radius: var(--radius); background: var(--primary-tint); color: var(--primary);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 700; line-height: 1;
  }
  .label { display: flex; flex-direction: column; }
  .title { font-size: var(--fs-sm); font-weight: 600; color: var(--text); }
  small  { font-size: var(--fs-xs); color: var(--text-faint); font-weight: 400; }
</style>

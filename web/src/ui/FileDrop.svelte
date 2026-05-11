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
  }
</script>

<label
  class="drop" class:over={dragOver}
  on:dragover|preventDefault={() => (dragOver = true)}
  on:dragleave={() => (dragOver = false)}
  on:drop={onDrop}
>
  <span>Drop PNG/JPEG or click to pick</span>
  <input type="file" multiple accept="image/png,image/jpeg" on:change={onPick} hidden />
</label>

<style>
  .drop { display: block; border: 2px dashed #aaa; padding: 1rem; text-align: center; cursor: pointer; }
  .drop.over { border-color: #36c; background: #eef5ff; }
</style>

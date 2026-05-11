<script lang="ts">
  import { onMount } from 'svelte';
  import { project } from './stores/project';
  import { bindPersistence, loadFromStorage } from './stores/persistence';
  import Sidebar from './ui/Sidebar.svelte';
  import PackSettings from './ui/PackSettings.svelte';
  import PaintingEditor from './editor/PaintingEditor.svelte';

  let selectedId: string | null = null;

  onMount(() => {
    const saved = loadFromStorage();
    if (saved) project.set(saved);
    return bindPersistence(project, 1000);
  });
</script>

<div class="app">
  <aside class="sidebar"><Sidebar bind:selectedId /></aside>
  <main class="editor">
    {#if selectedId}
      {#key selectedId}
        <PaintingEditor id={selectedId} />
      {/key}
    {:else}
      <p>Select a painting on the left, or drop images to add new ones.</p>
    {/if}
  </main>
  <aside class="pack"><PackSettings /></aside>
</div>

<style>
  .app { display: grid; grid-template-columns: 260px 1fr 320px; height: 100vh; }
  .sidebar, .pack { border: 1px solid #ddd; overflow: auto; padding: 0.5rem; }
  .editor { padding: 0.5rem; overflow: auto; }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { project } from './stores/project';
  import { bindPersistence, loadFromStorage, importProjectJSON, exportProjectJSON } from './stores/persistence';
  import { activeTab } from './stores/ui';
  import Topbar from './ui/Topbar.svelte';
  import Sidebar from './ui/Sidebar.svelte';
  import PaintingEditor from './editor/PaintingEditor.svelte';
  import EditorHeader from './ui/EditorHeader.svelte';
  import PaintingProperties from './ui/PaintingProperties.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import PackDrawer from './ui/PackDrawer.svelte';
  import TabBar from './ui/TabBar.svelte';
  import { buildMcaddonBlob, archiveFilename } from './mcpack/build';

  let selectedId: string | null = null;
  let building = false;
  let toast: string | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let importInput: HTMLInputElement;

  onMount(() => {
    const saved = loadFromStorage();
    if (saved) project.set(saved);
    if (selectedId === null && $project.paintings.length > 0) selectedId = $project.paintings[0].id;
    return bindPersistence(project, 1000);
  });

  $: if (selectedId && !$project.paintings.find((p) => p.id === selectedId)) selectedId = null;
  $: if (selectedId === null && $project.paintings.length > 0) selectedId = $project.paintings[0].id;

  function showToast(msg: string) {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 6000);
  }

  async function onBuild() {
    building = true;
    try {
      const blob = await buildMcaddonBlob($project);
      downloadBlob(blob, archiveFilename($project));
    } catch (err) {
      showToast(`Build failed: ${(err as Error).message}`);
    } finally {
      building = false;
    }
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function onExport() {
    downloadBlob(new Blob([exportProjectJSON($project)], { type: 'application/json' }),
      `${$project.pack.name || 'project'}-project.json`);
  }
  function onImport() { importInput?.click(); }
  async function onImportFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try { project.set(importProjectJSON(await f.text())); }
    catch (err) { showToast(`Import failed: ${(err as Error).message}`); }
  }

  function selectFromList(id: string) {
    selectedId = id;
    activeTab.set('edit');
  }
</script>

<div class="app">
  <Topbar {building} onbuild={onBuild} onexport={onExport} onimport={onImport} />
  <input type="file" accept="application/json" hidden bind:this={importInput} on:change={onImportFile} />

  <div class="body">
    <aside class="col sidebar-col" data-active={$activeTab === 'paintings'}>
      <Sidebar bind:selectedId onselect={selectFromList} />
    </aside>

    <main class="col editor-col" data-active={$activeTab === 'edit'} id="tabpanel-edit">
      {#if selectedId}
        <EditorHeader id={selectedId} />
        {#key selectedId}
          <PaintingEditor id={selectedId} />
        {/key}
      {:else}
        <EmptyState />
      {/if}
    </main>

    <aside class="col props-col" data-active={$activeTab === 'properties'} id="tabpanel-properties">
      {#if selectedId}
        <PaintingProperties id={selectedId} />
      {:else}
        <EmptyState
          title="No painting selected"
          body="Add an image or pick one from the list to edit its properties."
        />
      {/if}
    </aside>
  </div>

  <TabBar />
  <PackDrawer />

  {#if toast}
    <div class="toast" role="alert">{toast}</div>
  {/if}
</div>

<style>
  .app { height: 100vh; display: flex; flex-direction: column; }
  .body { flex: 1; display: grid; grid-template-columns: 240px 1fr 280px; min-height: 0; }
  .col { min-height: 0; overflow: auto; }
  .sidebar-col { background: var(--surface); border-right: 1px solid var(--border); }
  .editor-col  { display: flex; flex-direction: column; background: var(--bg); }
  .props-col   { background: var(--surface); border-left: 1px solid var(--border); }

  .toast {
    position: fixed; right: var(--space-7); bottom: var(--space-7);
    background: #fff; border: 1px solid var(--danger); color: var(--danger);
    padding: var(--space-4) var(--space-5); border-radius: var(--radius);
    box-shadow: var(--shadow); font-size: var(--fs-sm); max-width: 340px;
    z-index: 20;
  }

  @media (max-width: 899px) {
    .body { display: block; position: relative; }
    .col { display: none; height: 100%; }
    .col[data-active="true"] { display: flex; flex-direction: column; }
    .editor-col[data-active="true"] { display: flex; }
    .props-col[data-active="true"] { display: block; overflow: auto; }
  }
</style>

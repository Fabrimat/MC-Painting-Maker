<script lang="ts">
  import { onMount } from 'svelte';
  import { project } from './stores/project';
  import { bindPersistence, loadFromStorage, importProjectJSON, exportProjectJSON } from './stores/persistence';
  import { createHistory, type HistoryController } from './stores/history';
  import { activeTab } from './stores/ui';
  import { devMode } from './stores/devMode';
  import { incomingFiles, incomingError } from './pwa/incomingFiles';
  import { addImagesToProject } from './paintings/import';
  import {
    trackPaintingsAdded,
    trackMcaddonBuilt,
    trackBuildFailed,
    trackProjectExported,
    trackProjectImported,
    trackImportFailed,
    classifyBuildReason,
    classifyImportReason,
  } from './analytics/track';
  import Topbar from './ui/Topbar.svelte';
  import Sidebar from './ui/Sidebar.svelte';
  import PaintingEditor from './editor/PaintingEditor.svelte';
  import EditorHeader from './ui/EditorHeader.svelte';
  import PaintingProperties from './ui/PaintingProperties.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import PackDrawer from './ui/PackDrawer.svelte';
  import TabBar from './ui/TabBar.svelte';
  import UpdateToast from './ui/UpdateToast.svelte';
  import { buildMcaddonBlob, archiveFilename } from './mcpack/build';

  let selectedId: string | null = null;
  let building = false;
  let zipBuilding = false;
  let toast: string | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let importInput: HTMLInputElement;
  let history: HistoryController | null = null;

  onMount(() => {
    const saved = loadFromStorage();
    if (saved) project.set(saved);
    if (selectedId === null && $project.paintings.length > 0) selectedId = $project.paintings[0].id;
    history = createHistory(project);
    const stopPersist = bindPersistence(project, 1000);
    window.addEventListener('keydown', onKeyDown);

    const unsubFiles = incomingFiles.subscribe(async (payload) => {
      if (!payload || payload.files.length === 0) return;
      incomingFiles.set(null);
      const { files, source } = payload;
      try {
        const result = await addImagesToProject($project, files);
        project.set(result.state);
        if (result.addedIds.length > 0) {
          trackPaintingsAdded(source, result.addedIds.length);
          if (selectedId === null) {
            selectedId = result.addedIds[0];
            activeTab.set('edit');
          }
        }
      } catch (err) {
        trackImportFailed(source, classifyImportReason(err));
        showToast(`Import failed: ${(err as Error).message}`);
      }
    });
    const unsubError = incomingError.subscribe((msg) => {
      if (!msg) return;
      incomingError.set(null);
      showToast(msg);
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      history?.destroy();
      history = null;
      stopPersist();
      unsubFiles();
      unsubError();
    };
  });

  function onKeyDown(e: KeyboardEvent) {
    if (!history) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      history.undo();
    } else if ((key === 'y' && !e.shiftKey) || (key === 'z' && e.shiftKey)) {
      e.preventDefault();
      history.redo();
    }
  }

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
      trackMcaddonBuilt($project.paintings.length);
      // Bump the patch number AFTER the file is on disk so a failed build does
      // not waste a version. Skipped when the user has opted out via Pack settings.
      if ($project.pack.autoBumpVersion) {
        project.update((s) => ({
          ...s,
          pack: {
            ...s.pack,
            semver: [s.pack.semver[0], s.pack.semver[1], s.pack.semver[2] + 1],
          },
        }));
      }
    } catch (err) {
      trackBuildFailed(classifyBuildReason(err));
      showToast(`Build failed: ${(err as Error).message}`);
    } finally {
      building = false;
    }
  }

  async function onDownloadZip() {
    if (zipBuilding || $project.paintings.length === 0) return;
    zipBuilding = true;
    try {
      const blob = await buildMcaddonBlob($project);
      downloadBlob(blob, archiveFilename($project).replace(/\.mcaddon$/, '.zip'));
    } catch (err) {
      showToast(`Build failed: ${(err as Error).message}`);
    } finally {
      zipBuilding = false;
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
    trackProjectExported($project.paintings.length);
  }
  function onImport() { importInput?.click(); }
  async function onImportFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const state = importProjectJSON(await f.text());
      project.set(state);
      trackProjectImported(state.paintings.length);
    } catch (err) {
      trackImportFailed('json', classifyImportReason(err));
      showToast(`Import failed: ${(err as Error).message}`);
    }
  }

  function selectFromList(id: string) {
    selectedId = id;
    activeTab.set('edit');
  }
</script>

<div class="app" class:debug={$devMode}>
  {#if $devMode}
    <div class="debug-banner" role="status">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/>
        <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/>
        <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>
        <path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/>
        <path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/>
        <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/>
        <path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>
      </svg>
      <strong>DEBUG MODE</strong>
      <span>Dedicated to website development and debugging. Extra logs in the console, raw <code>.zip</code> export in the topbar.</span>
      <button type="button" class="banner-off" on:click={() => devMode.set(false)}>Turn off</button>
    </div>
  {/if}
  <Topbar {building} {zipBuilding} onbuild={onBuild} ondownloadzip={onDownloadZip} />
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
  <PackDrawer onimport={onImport} onexport={onExport} />

  {#if toast}
    <div class="toast" role="alert">{toast}</div>
  {/if}

  <UpdateToast />
</div>

<style>
  .app { height: 100vh; display: flex; flex-direction: column; }
  .debug-banner {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-3) var(--space-7);
    background: var(--cta); color: #fff;
    font-size: var(--fs-sm); font-weight: 600;
    box-shadow: var(--shadow-sm);
  }
  .debug-banner strong {
    font-size: var(--fs-md); font-weight: 800;
    letter-spacing: .08em; text-transform: uppercase;
  }
  .debug-banner span {
    flex: 1; font-weight: 500; opacity: .95;
  }
  .debug-banner code {
    font-family: var(--font-mono, ui-monospace, monospace);
    background: rgba(255,255,255,.18);
    padding: 0 4px; border-radius: var(--radius-sm);
  }
  .banner-off {
    padding: 4px 10px; border-radius: var(--radius);
    background: rgba(255,255,255,.18); color: #fff;
    font-weight: 600; font-size: var(--fs-xs);
    border: 1px solid rgba(255,255,255,.4);
  }
  .banner-off:hover { background: rgba(255,255,255,.28); }
  .app.debug { outline: 3px solid var(--cta); outline-offset: -3px; }
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

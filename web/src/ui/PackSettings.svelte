<script lang="ts">
  import { project } from '../stores/project';
  import { buildMcaddonBlob, archiveFilename } from '../mcpack/build';
  import { exportProjectJSON, importProjectJSON } from '../stores/persistence';

  let building = false;
  let error: string | null = null;

  async function onBuild() {
    error = null;
    building = true;
    try {
      const blob = await buildMcaddonBlob($project);
      downloadBlob(blob, archiveFilename($project));
    } catch (err) {
      error = (err as Error).message;
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

  async function onImport(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      project.set(importProjectJSON(text));
    } catch (err) {
      error = `Import failed: ${(err as Error).message}`;
    }
  }
</script>

<h3>Pack Settings</h3>
<label>Name <input bind:value={$project.pack.name} /></label>
<label>Description <input bind:value={$project.pack.description} /></label>
<label>Namespace <input bind:value={$project.pack.namespace} /></label>
<label>Creative group name <input bind:value={$project.pack.creativeGroupName} /></label>

<h4>Version</h4>
<div class="row">
  <input type="number" min="0" bind:value={$project.pack.semver[0]} />
  <input type="number" min="0" bind:value={$project.pack.semver[1]} />
  <input type="number" min="0" bind:value={$project.pack.semver[2]} />
</div>

<h4>Min engine version</h4>
<div class="row">
  <input type="number" min="0" bind:value={$project.pack.minEngineVersion[0]} />
  <input type="number" min="0" bind:value={$project.pack.minEngineVersion[1]} />
  <input type="number" min="0" bind:value={$project.pack.minEngineVersion[2]} />
</div>

<hr />
<button on:click={onBuild} disabled={building || $project.paintings.length === 0}>
  {building ? 'Building…' : 'Build .mcaddon'}
</button>
<button on:click={onExport}>Export project JSON</button>
<label class="imp">
  Import project JSON
  <input type="file" accept="application/json" on:change={onImport} hidden />
</label>
{#if error}<p class="err">{error}</p>{/if}

<style>
  label { display: block; margin: 4px 0; font-size: 0.9rem; }
  label input:not([type]) { display: block; width: 100%; }
  .row { display: flex; gap: 4px; }
  .row input { width: 60px; }
  .err { color: #c00; }
  .imp { display: inline-block; padding: 4px 8px; border: 1px solid #aaa; cursor: pointer; }
  button { margin: 4px 4px 4px 0; }
</style>

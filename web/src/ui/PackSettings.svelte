<script lang="ts">
  import { project } from '../stores/project';
  import { buildMcaddonBlob, archiveFilename } from '../mcpack/build';
  import { exportProjectJSON, importProjectJSON } from '../stores/persistence';
  import { z } from 'zod';
  const NamespaceTest = z.string()
    .regex(/^[a-z][a-z0-9_]{0,15}$/)
    .refine((v) => v !== 'minecraft');
  let namespaceError: string | null = null;
  function validateNamespace() {
    const r = NamespaceTest.safeParse($project.pack.namespace);
    namespaceError = r.success ? null : 'Use lowercase a-z, 0-9, _ (max 16 chars), not "minecraft".';
  }

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

  $: rawSize = JSON.stringify($project).length;
  $: sizeMb = (rawSize / (1024 * 1024)).toFixed(2);
  $: tooBig = rawSize > 4 * 1024 * 1024;

  async function onPackIconPicked(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const b64 = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const v = String(fr.result);
        const idx = v.indexOf(',');
        resolve(idx >= 0 ? v.slice(idx + 1) : v);
      };
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(f);
    });
    project.update((s) => ({ ...s, pack: { ...s.pack, iconPngBase64: b64 } }));
  }
  function clearPackIcon() {
    project.update((s) => ({ ...s, pack: { ...s.pack, iconPngBase64: null } }));
  }
</script>

<h3>Pack Settings</h3>
<label>Name <input bind:value={$project.pack.name} /></label>
<label>Description <input bind:value={$project.pack.description} /></label>
<label>Namespace
  <input bind:value={$project.pack.namespace} on:blur={validateNamespace} class:invalid={namespaceError !== null} />
  {#if namespaceError}<small class="err">{namespaceError}</small>{/if}
</label>
<label>Creative group name <input bind:value={$project.pack.creativeGroupName} /></label>
<label>Pack icon
  <input type="file" accept="image/png" on:change={onPackIconPicked} />
</label>
{#if $project.pack.iconPngBase64}
  <div class="icon-preview">
    <img src={`data:image/png;base64,${$project.pack.iconPngBase64}`} alt="pack icon" />
    <button on:click={clearPackIcon}>Clear icon</button>
  </div>
{/if}

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

<p class="size" class:warn={tooBig}>Project size: {sizeMb} MB / ~5 MB</p>
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
  .size { font-size: 0.85rem; color: #555; }
  .size.warn { color: #c60; font-weight: bold; }
  input.invalid { border-color: #c00; }
  small.err { display: block; color: #c00; font-size: 0.75rem; }
  .icon-preview { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .icon-preview img { width: 48px; height: 48px; object-fit: contain; border: 1px solid #ddd; }
</style>

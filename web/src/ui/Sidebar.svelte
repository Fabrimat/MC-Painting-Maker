<script lang="ts">
  import { project } from '../stores/project';
  import { createPaintingFromImage } from '../paintings/defaults';
  import type { Painting } from '../paintings/types';
  import FileDrop from './FileDrop.svelte';
  export let selectedId: string | null;

  async function addFromFiles(files: FileList) {
    const additions: Painting[] = [];
    for (const f of Array.from(files)) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const dataUrl = await fileDataUrl(f);
      const bmp = await createImageBitmap(new Blob([bytes], { type: f.type }));
      additions.push(createPaintingFromImage(
        stripExt(f.name),
        { pngBase64: dataUrl, naturalW: bmp.width, naturalH: bmp.height },
      ));
    }
    project.update((v) => ({ ...v, paintings: [...v.paintings, ...additions] }));
  }

  function fileDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const v = String(fr.result);
        const idx = v.indexOf(',');
        resolve(idx >= 0 ? v.slice(idx + 1) : v);
      };
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(f);
    });
  }

  function stripExt(name: string): string {
    return name.replace(/\.[^.]+$/, '');
  }

  function remove(id: string) {
    project.update((v) => ({ ...v, paintings: v.paintings.filter((p) => p.id !== id) }));
    if (selectedId === id) selectedId = null;
  }
</script>

<header>
  <FileDrop on:files={(e) => addFromFiles(e.detail)} />
</header>
<ul>
  {#each $project.paintings as p (p.id)}
    <li class:selected={selectedId === p.id}>
      <button class="thumb" on:click={() => (selectedId = p.id)} aria-label="Select painting">
        {#if p.source}
          <img src={`data:image/png;base64,${p.source.pngBase64}`} alt="" />
        {:else}
          <span class="ph">?</span>
        {/if}
      </button>
      <div class="meta">
        <input
          type="text"
          placeholder="Name"
          bind:value={p.name}
          on:input={() => project.update((v) => v)}
        />
        <small>{(p.canvasW16/16).toFixed(2)}×{(p.canvasH16/16).toFixed(2)}</small>
      </div>
      <button class="del" on:click={() => remove(p.id)} title="Delete">✕</button>
    </li>
  {/each}
</ul>
{#if $project.paintings.length === 0}
  <p class="empty">No paintings yet. Drop images above.</p>
{/if}

<style>
  ul { list-style: none; padding: 0; margin: 0.5rem 0; }
  li {
    display: flex; align-items: center; gap: 4px;
    padding: 2px; margin-bottom: 2px;
    border-radius: 4px;
  }
  li.selected { background: #ddebff; }
  .thumb {
    flex: 0 0 auto; width: 28px; height: 28px;
    padding: 0; border: 1px solid #ccc; background: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
  }
  .thumb img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
  .thumb .ph { color: #aaa; font-size: 0.8rem; }
  .meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .meta input { width: 100%; box-sizing: border-box; font-size: 0.85rem; }
  .meta small { color: #888; font-size: 0.7rem; }
  .del { flex: 0 0 auto; }
  .empty { color: #777; font-size: 0.9rem; }
</style>

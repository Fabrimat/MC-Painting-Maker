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
      fr.onload = () => resolve(String(fr.result));
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
      <button on:click={() => (selectedId = p.id)}>
        {p.name || '(untitled)'} — {(p.canvasW16/16).toFixed(2)}×{(p.canvasH16/16).toFixed(2)}
      </button>
      <button class="del" on:click={() => remove(p.id)} title="Delete">✕</button>
    </li>
  {/each}
</ul>
{#if $project.paintings.length === 0}
  <p class="empty">No paintings yet. Drop images above.</p>
{/if}

<style>
  ul { list-style: none; padding: 0; margin: 0.5rem 0; }
  li { display: flex; gap: 4px; }
  li button { flex: 1; text-align: left; }
  li.selected button { background: #ddebff; }
  .del { flex: 0 0 auto; }
  .empty { color: #777; font-size: 0.9rem; }
</style>

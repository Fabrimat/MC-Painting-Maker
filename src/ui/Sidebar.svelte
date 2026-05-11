<script lang="ts">
  import { project } from '../stores/project';
  import { createPaintingFromImage, ensurePackUUIDs } from '../paintings/defaults';
  import type { Painting } from '../paintings/types';
  import FileDrop from './FileDrop.svelte';
  import PaintingList from './PaintingList.svelte';
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
    project.update((v) => {
      const withUuids = ensurePackUUIDs(v);
      return { ...withUuids, paintings: [...withUuids.paintings, ...additions] };
    });
    if (selectedId === null && additions.length > 0) selectedId = additions[0].id;
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

  function stripExt(name: string): string { return name.replace(/\.[^.]+$/, ''); }

  function remove(id: string) {
    project.update((v) => ({ ...v, paintings: v.paintings.filter((p) => p.id !== id) }));
    if (selectedId === id) selectedId = null;
  }
</script>

<aside class="sidebar">
  <h4 class="title">Paintings · {$project.paintings.length}</h4>
  <FileDrop on:files={(e) => addFromFiles(e.detail)} />
  <PaintingList
    paintings={$project.paintings}
    {selectedId}
    on:select={(e) => (selectedId = e.detail)}
    on:remove={(e) => remove(e.detail)}
  />
</aside>

<style>
  .sidebar { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); height: 100%; overflow: auto; }
  .title {
    font-size: var(--fs-xs); font-weight: 700; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: .06em; margin: 0;
    padding: 0 var(--space-1);
  }
</style>

<script lang="ts">
  import { project } from '../stores/project';
  import { createPaintingFromImage, ensurePackUUIDs } from '../paintings/defaults';
  import type { Painting } from '../paintings/types';
  import FileDrop from './FileDrop.svelte';
  import PaintingList from './PaintingList.svelte';
  export let selectedId: string | null;
  export let onselect: (id: string) => void = () => {};

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
  <FileDrop onfiles={(files) => addFromFiles(files)} />
  <PaintingList
    paintings={$project.paintings}
    {selectedId}
    onselect={(id) => { selectedId = id; onselect(id); }}
    onremove={(id) => remove(id)}
  />

  <footer class="credits">
    <p class="line">
      Built with <span class="heart" aria-hidden="true">♥</span> by
      <a href="https://larosa.work/" target="_blank" rel="noopener noreferrer">Fabrizio La Rosa</a>
    </p>
    <p class="line">
      <a href="https://github.com/Fabrimat/MC-Painting-Maker" target="_blank" rel="noopener noreferrer">Source</a>
      ·
      <a href="https://www.linkedin.com/in/fabriziolarosa/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      ·
      <a href="./privacy.html">Privacy</a>
    </p>
  </footer>
</aside>

<style>
  .sidebar { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); height: 100%; overflow: auto; }
  .title {
    font-size: var(--fs-xs); font-weight: 700; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: .06em; margin: 0;
    padding: 0 var(--space-1);
  }

  .credits {
    margin-top: auto;
    padding: var(--space-5) var(--space-1) var(--space-1);
    border-top: 1px solid var(--border);
    font-size: var(--fs-xs);
    color: var(--text-faint);
    text-align: center;
    line-height: 1.5;
  }
  .credits .line { margin: 0; }
  .credits a { color: var(--text-muted); text-decoration: none; }
  .credits a:hover { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
  .credits .heart { color: var(--danger); }
</style>

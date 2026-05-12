<script lang="ts">
  import { project } from '../stores/project';
  import { clearView } from '../stores/viewState';
  import { addImagesToProject } from '../paintings/import';
  import FileDrop from './FileDrop.svelte';
  import PaintingList from './PaintingList.svelte';
  export let selectedId: string | null;
  export let onselect: (id: string) => void = () => {};

  async function addFromFiles(files: FileList) {
    const result = await addImagesToProject($project, files);
    project.set(result.state);
    if (selectedId === null && result.addedIds.length > 0) {
      selectedId = result.addedIds[0];
    }
  }

  function remove(id: string) {
    project.update((v) => ({ ...v, paintings: v.paintings.filter((p) => p.id !== id) }));
    clearView(id);
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
      Built with
      <svg class="heart" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>
      </svg>
      by
      <a href="https://larosa.work/" target="_blank" rel="noopener noreferrer">Fabrizio La Rosa</a>
    </p>
    <p class="line">
      <a href="https://github.com/Fabrimat/MC-Painting-Maker" target="_blank" rel="noopener noreferrer">Source</a>
      ·
      <a href="https://www.linkedin.com/in/fabriziolarosa/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      ·
      <a href="https://ko-fi.com/fabriziolarosa" target="_blank" rel="noopener noreferrer">Ko-fi</a>
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
  .credits .heart { color: var(--danger); vertical-align: -2px; display: inline-block; }
</style>

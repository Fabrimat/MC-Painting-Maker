<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Konva from 'konva';
  import { project } from '../stores/project';
  import type { Painting, Density } from '../paintings/types';
  import { resolveDensity } from '../paintings/density';

  export let id: string;

  let host: HTMLDivElement;
  let stage: Konva.Stage | null = null;
  let bgLayer: Konva.Layer;
  let imageLayer: Konva.Layer;
  let gridLayer: Konva.Layer;
  let imageNode: Konva.Image | null = null;

  $: painting = $project.paintings.find((p) => p.id === id) ?? null;

  // Pixels-per-sixteenth in the stage. 12 px per 1/16-block keeps the editor usable for typical sizes.
  let pps = 12;

  onMount(async () => {
    stage = new Konva.Stage({ container: host, width: host.clientWidth, height: host.clientHeight });
    bgLayer = new Konva.Layer();
    imageLayer = new Konva.Layer();
    gridLayer = new Konva.Layer();
    stage.add(bgLayer, imageLayer, gridLayer);
    await refresh();
  });

  onDestroy(() => stage?.destroy());

  async function refresh() {
    if (!stage || !painting) return;
    // Keep stage size synced with its host (handles window resize between refreshes).
    stage.size({ width: host.clientWidth, height: host.clientHeight });
    bgLayer.destroyChildren();
    imageLayer.destroyChildren();
    gridLayer.destroyChildren();
    drawCheckerboard();
    await drawImage();
    drawGrid();
    centerAndConfigurePan();
    bgLayer.draw(); imageLayer.draw(); gridLayer.draw();
  }

  function centerAndConfigurePan() {
    if (!stage || !painting) return;
    const canvasW = painting.canvasW16 * pps;
    const canvasH = painting.canvasH16 * pps;
    const hostW = stage.width();
    const hostH = stage.height();
    // Center the canvas content inside the host. Stage position offsets all layers.
    stage.position({ x: (hostW - canvasW) / 2, y: (hostH - canvasH) / 2 });
    // Only allow panning when content exceeds the visible area on either axis.
    const overflows = canvasW > hostW || canvasH > hostH;
    stage.draggable(overflows);
  }

  function drawCheckerboard() {
    if (!painting) return;
    const W = painting.canvasW16 * pps;
    const H = painting.canvasH16 * pps;
    const cell = pps;
    bgLayer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: '#f0f0f0', listening: false }));
    for (let y = 0; y < painting.canvasH16; y++) {
      for (let x = 0; x < painting.canvasW16; x++) {
        if ((x + y) % 2 === 0) {
          bgLayer.add(new Konva.Rect({
            x: x * cell, y: y * cell, width: cell, height: cell, fill: '#e0e0e0', listening: false,
          }));
        }
      }
    }
  }

  async function drawImage() {
    if (!painting?.source) return;
    const img = new Image();
    img.src = `data:image/png;base64,${painting.source.pngBase64}`;
    await new Promise<void>((r, e) => { img.onload = () => r(); img.onerror = () => e(new Error('image load')); });
    imageNode = new Konva.Image({
      image: img,
      x: painting.transform.x16 * pps,
      y: painting.transform.y16 * pps,
      width: painting.transform.w16 * pps,
      height: painting.transform.h16 * pps,
      draggable: true,
    });
    imageNode.on('dragmove', () => {
      if (!imageNode) return;
      const sx = Math.round(imageNode.x() / pps) * pps;
      const sy = Math.round(imageNode.y() / pps) * pps;
      imageNode.position({ x: sx, y: sy });
    });
    imageNode.on('dragend', commitTransform);
    imageLayer.add(imageNode);

    const tr = new Konva.Transformer({
      nodes: [imageNode],
      rotateEnabled: false,
      keepRatio: false,
      anchorSize: 10,
      enabledAnchors: ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center'],
    });
    tr.on('transformend', () => {
      if (!imageNode) return;
      const w = imageNode.width() * imageNode.scaleX();
      const h = imageNode.height() * imageNode.scaleY();
      imageNode.scale({ x: 1, y: 1 });
      imageNode.width(w);
      imageNode.height(h);
      commitTransform();
    });
    imageLayer.add(tr);
  }

  function drawGrid() {
    if (!painting) return;
    const W = painting.canvasW16 * pps;
    const H = painting.canvasH16 * pps;
    if (pps >= 6) {
      for (let i = 0; i <= painting.canvasW16; i++) {
        gridLayer.add(new Konva.Line({
          points: [i * pps, 0, i * pps, H],
          stroke: '#0001', strokeWidth: 1, listening: false,
        }));
      }
      for (let i = 0; i <= painting.canvasH16; i++) {
        gridLayer.add(new Konva.Line({
          points: [0, i * pps, W, i * pps],
          stroke: '#0001', strokeWidth: 1, listening: false,
        }));
      }
    }
    for (let i = 0; i <= painting.canvasW16 / 16; i++) {
      gridLayer.add(new Konva.Line({
        points: [i * 16 * pps, 0, i * 16 * pps, H],
        stroke: '#000a', strokeWidth: 2, listening: false,
      }));
    }
    for (let i = 0; i <= painting.canvasH16 / 16; i++) {
      gridLayer.add(new Konva.Line({
        points: [0, i * 16 * pps, W, i * 16 * pps],
        stroke: '#000a', strokeWidth: 2, listening: false,
      }));
    }
  }

  function commitTransform() {
    if (!painting || !imageNode) return;
    const x16 = Math.max(0, Math.round(imageNode.x() / pps));
    const y16 = Math.max(0, Math.round(imageNode.y() / pps));
    const w16 = Math.max(1, Math.round(imageNode.width() / pps));
    const h16 = Math.max(1, Math.round(imageNode.height() / pps));
    imageNode.position({ x: x16 * pps, y: y16 * pps });
    imageNode.width(w16 * pps);
    imageNode.height(h16 * pps);
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) =>
        p.id === id ? { ...p, transform: { ...p.transform, x16, y16, w16, h16 } } : p),
    }));
  }

  $: if (painting) refresh().catch(console.error);
  $: density = painting ? resolveDensity(painting) : 1;

  function parseDensity(v: string): Density {
    if (v === 'auto') return 'auto';
    const n = Number(v);
    if ([1,2,4,8,16,32,64].includes(n)) return n as Density;
    return 'auto';
  }
  function updateCanvas(axis: 'W' | 'H', blocks: number) {
    const px16 = Math.max(1, Math.round(blocks * 16));
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id
        ? { ...p, [axis === 'W' ? 'canvasW16' : 'canvasH16']: px16 }
        : p),
    }));
  }
  function updatePainting(patch: Partial<Painting>) {
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? { ...p, ...patch } : p),
    }));
  }
  function updateResampling(v: string) {
    updatePainting({ resampling: v === 'pixelated' ? 'pixelated' : 'smooth' });
  }
  function updateMaterial(v: string) {
    updatePainting({ material: v === 'alphablend' ? 'alphablend' : 'alphatest' });
  }
</script>

{#if painting}
  <div class="bar">
    <label>W
      <input type="number" step="0.0625" min="0.0625"
        value={painting.canvasW16 / 16}
        on:change={(e) => updateCanvas('W', e.currentTarget.valueAsNumber)} />
    </label>
    <label>H
      <input type="number" step="0.0625" min="0.0625"
        value={painting.canvasH16 / 16}
        on:change={(e) => updateCanvas('H', e.currentTarget.valueAsNumber)} />
    </label>
    <label>Density
      <select value={painting.textureDensity}
        on:change={(e) => updatePainting({ textureDensity: parseDensity(e.currentTarget.value) })}>
        <option value="auto">auto ({density}×)</option>
        {#each [1,2,4,8,16,32,64] as n}<option value={n}>{n}×</option>{/each}
      </select>
    </label>
    <label>Resampling
      <select value={painting.resampling}
        on:change={(e) => updateResampling(e.currentTarget.value)}>
        <option value="smooth">smooth</option>
        <option value="pixelated">pixelated</option>
      </select>
    </label>
    <label>Material
      <select value={painting.material}
        on:change={(e) => updateMaterial(e.currentTarget.value)}>
        <option value="alphatest">alphatest</option>
        <option value="alphablend">alphablend</option>
      </select>
    </label>
    <label>Name
      <input type="text" bind:value={painting.name} on:change={() => updatePainting({})} />
    </label>
    <span class="info">Texture: {painting.canvasW16 * density}×{painting.canvasH16 * density} px</span>
  </div>
  <div class="canvas-host" bind:this={host}></div>
{:else}
  <p>Painting not found.</p>
{/if}

<style>
  .bar { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 0; }
  .bar label { display: flex; flex-direction: column; font-size: 0.8rem; }
  .canvas-host { width: 100%; height: calc(100vh - 110px); border: 1px solid #ccc; }
  .info { align-self: center; color: #555; font-size: 0.85rem; }
</style>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Konva from 'konva';
  import { project } from '../stores/project';
  import { rasterizeForPreview } from './previewRaster';
  import type { Painting } from '../paintings/types';

  export let id: string;

  let host: HTMLDivElement;
  let stage: Konva.Stage | null = null;
  let bgLayer: Konva.Layer;
  let imageLayer: Konva.Layer;
  let gridLayer: Konva.Layer;
  let imageNode: Konva.Image | null = null;
  let rasterLayer: Konva.Layer;
  let rasterImageNode: Konva.Image | null = null;
  let cachedRasterImg: HTMLImageElement | null = null;
  let rasterToken = 0;
  let rasterSig = '';
  let mode: 'live' | 'settled' = 'settled';

  function currentRasterSig(p: Painting): string {
    const t = p.transform;
    const s = p.source;
    return [
      p.canvasW16, p.canvasH16, p.textureDensity, p.resampling,
      t.x16, t.y16, t.w16, t.h16, t.rotation, t.flipX, t.flipY,
      s ? s.pngBase64.length : 0, s ? s.naturalW : 0, s ? s.naturalH : 0,
    ].join(':');
  }

  $: painting = $project.paintings.find((p) => p.id === id) ?? null;

  let pps = 12;

  onMount(async () => {
    stage = new Konva.Stage({ container: host, width: host.clientWidth, height: host.clientHeight });
    bgLayer = new Konva.Layer();
    imageLayer = new Konva.Layer();
    gridLayer = new Konva.Layer();
    rasterLayer = new Konva.Layer();
    stage.add(bgLayer, imageLayer, rasterLayer, gridLayer);
    await refresh();
  });

  onDestroy(() => stage?.destroy());

  async function refresh() {
    if (!stage || !painting) return;
    stage.size({ width: host.clientWidth, height: host.clientHeight });
    bgLayer.destroyChildren();
    imageLayer.destroyChildren();
    rasterLayer.destroyChildren();
    gridLayer.destroyChildren();
    rasterImageNode = null;
    drawCheckerboard();
    await drawImage();
    drawRasterPreview();
    drawGrid();
    centerAndConfigurePan();
    bgLayer.draw(); imageLayer.draw(); rasterLayer.draw(); gridLayer.draw();
    maybeStartRaster();
  }

  function centerAndConfigurePan() {
    if (!stage || !painting) return;
    const canvasW = painting.canvasW16 * pps;
    const canvasH = painting.canvasH16 * pps;
    const hostW = stage.width();
    const hostH = stage.height();
    stage.position({ x: (hostW - canvasW) / 2, y: (hostH - canvasH) / 2 });
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
      imageSmoothingEnabled: painting.resampling === 'smooth',
    });
    imageNode.on('dragstart', () => {
      mode = 'live';
      rasterToken++;
      if (rasterImageNode) { rasterImageNode.hide(); rasterLayer.batchDraw(); }
    });
    imageNode.on('dragmove', () => {
      if (!imageNode) return;
      const sx = Math.round(imageNode.x() / pps) * pps;
      const sy = Math.round(imageNode.y() / pps) * pps;
      imageNode.position({ x: sx, y: sy });
    });
    imageNode.on('dragend', () => {
      mode = 'settled';
      if (rasterImageNode) { rasterImageNode.show(); rasterLayer.batchDraw(); }
      commitTransform();
    });
    imageLayer.add(imageNode);

    const tr = new Konva.Transformer({
      nodes: [imageNode],
      rotateEnabled: false,
      keepRatio: false,
      anchorSize: 10,
      enabledAnchors: ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center'],
    });
    tr.on('transformstart', () => {
      mode = 'live';
      rasterToken++;
      if (rasterImageNode) { rasterImageNode.hide(); rasterLayer.batchDraw(); }
    });
    tr.on('transformend', () => {
      if (!imageNode) return;
      const w = imageNode.width() * imageNode.scaleX();
      const h = imageNode.height() * imageNode.scaleY();
      imageNode.scale({ x: 1, y: 1 });
      imageNode.width(w);
      imageNode.height(h);
      mode = 'settled';
      if (rasterImageNode) { rasterImageNode.show(); rasterLayer.batchDraw(); }
      commitTransform();
    });
    imageLayer.add(tr);
  }

  function drawRasterPreview() {
    if (!painting || !cachedRasterImg) return;
    rasterImageNode = new Konva.Image({
      image: cachedRasterImg,
      x: 0,
      y: 0,
      width: painting.canvasW16 * pps,
      height: painting.canvasH16 * pps,
      imageSmoothingEnabled: false,
      listening: false,
      visible: mode === 'settled',
    });
    rasterLayer.add(rasterImageNode);
  }

  function drawGrid() {
    if (!painting) return;
    const W = painting.canvasW16 * pps;
    const H = painting.canvasH16 * pps;
    if (pps >= 6) {
      for (let i = 0; i <= painting.canvasW16; i++) {
        gridLayer.add(new Konva.Line({ points: [i * pps, 0, i * pps, H], stroke: '#0001', strokeWidth: 1, listening: false }));
      }
      for (let i = 0; i <= painting.canvasH16; i++) {
        gridLayer.add(new Konva.Line({ points: [0, i * pps, W, i * pps], stroke: '#0001', strokeWidth: 1, listening: false }));
      }
    }
    for (let i = 0; i <= painting.canvasW16 / 16; i++) {
      gridLayer.add(new Konva.Line({ points: [i * 16 * pps, 0, i * 16 * pps, H], stroke: '#000a', strokeWidth: 2, listening: false }));
    }
    for (let i = 0; i <= painting.canvasH16 / 16; i++) {
      gridLayer.add(new Konva.Line({ points: [0, i * 16 * pps, W, i * 16 * pps], stroke: '#000a', strokeWidth: 2, listening: false }));
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

  async function maybeStartRaster() {
    if (!painting) return;
    if (mode === 'live') return;
    const sig = currentRasterSig(painting);
    if (sig === rasterSig && cachedRasterImg) return;
    rasterSig = sig;
    rasterToken++;
    const myToken = rasterToken;
    const result = await rasterizeForPreview(painting, myToken);
    if (!result || result.token !== rasterToken) return;
    cachedRasterImg = result.image;
    if (rasterImageNode) {
      rasterImageNode.image(cachedRasterImg);
    } else {
      drawRasterPreview();
    }
    rasterLayer.batchDraw();
  }

  $: if (painting) refresh().catch(console.error);
</script>

<div class="canvas-wrap">
  <div class="canvas-host" bind:this={host}></div>
</div>

<style>
  .canvas-wrap { flex: 1; padding: var(--space-7); background: var(--surface-2); min-height: 0; }
  .canvas-host {
    width: 100%; height: 100%;
    background: #fff; border: 1px solid var(--border); border-radius: var(--radius-lg);
    overflow: hidden;
  }
</style>

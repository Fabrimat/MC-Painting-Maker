<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Konva from 'konva';
  import { project } from '../stores/project';
  import { rasterizeForPreview } from './previewRaster';
  import { computeZoomBounds, fitView, zoomAtPoint, clampPan, type View } from './zoomMath';
  import { loadView, saveView, flushPendingSaves } from '../stores/viewState';
  import CanvasToolbar from '../ui/CanvasToolbar.svelte';
  import type { Painting } from '../paintings/types';

  export let id: string;

  let host: HTMLDivElement;
  let stage: Konva.Stage | null = null;
  let resizeObs: ResizeObserver | null = null;
  let bgLayer: Konva.Layer;
  let imageLayer: Konva.Layer;
  let gridLayer: Konva.Layer;
  let imageNode: Konva.Image | null = null;
  let rasterLayer: Konva.Layer;
  let rasterImageNode: Konva.Image | null = null;
  let overlayLayer: Konva.Layer;
  let overlayRects: { top: Konva.Rect; bottom: Konva.Rect; left: Konva.Rect; right: Konva.Rect } | null = null;
  let cachedRasterImg: HTMLImageElement | null = null;
  let rasterToken = 0;
  let rasterSig = '';
  let mode: 'live' | 'settled' = 'settled';

  const basePps = 12;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let pps = basePps;
  $: bounds = stage
    ? computeZoomBounds(painting?.canvasW16 ?? 16, painting?.canvasH16 ?? 16, stage.width(), stage.height(), basePps)
    : { minZoom: 0.1, maxZoom: 8 };

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

  onMount(async () => {
    stage = new Konva.Stage({ container: host, width: host.clientWidth, height: host.clientHeight });
    bgLayer = new Konva.Layer();
    imageLayer = new Konva.Layer();
    gridLayer = new Konva.Layer();
    rasterLayer = new Konva.Layer();
    overlayLayer = new Konva.Layer({ listening: false });
    stage.add(bgLayer, imageLayer, rasterLayer, overlayLayer, gridLayer);
    stage.draggable(true);
    stage.on('dragend', onStageDragEnd);
    stage.on('wheel', onWheel);
    window.addEventListener('keydown', onKeyDown);
    resizeObs = new ResizeObserver(() => { onResize(); });
    resizeObs.observe(host);
    initView();
    await refresh();
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
    resizeObs?.disconnect();
    resizeObs = null;
    flushPendingSaves();
    stage?.destroy();
  });

  function initView() {
    if (!stage || !painting) return;
    const hostW = stage.width();
    const hostH = stage.height();
    const saved = loadView(id);
    if (saved) {
      const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, hostW, hostH, basePps);
      const clampedZoom = Math.max(b.minZoom, Math.min(b.maxZoom, saved.zoom));
      const clamped = clampPan(
        { zoom: clampedZoom, panX: saved.panX, panY: saved.panY },
        painting.canvasW16, painting.canvasH16, hostW, hostH, basePps,
      );
      zoom = clamped.zoom; panX = clamped.panX; panY = clamped.panY;
    } else {
      const v = fitView(painting.canvasW16, painting.canvasH16, hostW, hostH, basePps);
      zoom = v.zoom; panX = v.panX; panY = v.panY;
    }
    pps = basePps * zoom;
  }

  function applyView() {
    if (!stage) return;
    stage.position({ x: panX, y: panY });
  }

  function persistView() {
    saveView(id, { zoom, panX, panY });
  }

  function onStageDragEnd() {
    if (!stage) return;
    const pos = stage.position();
    if (!painting) return;
    const clamped = clampPan(
      { zoom, panX: pos.x, panY: pos.y },
      painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps,
    );
    panX = clamped.panX; panY = clamped.panY;
    applyView();
    persistView();
  }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    if (!stage || !painting) return;
    e.evt.preventDefault();
    const ev = e.evt;
    if (ev.ctrlKey || ev.metaKey) {
      const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      const pivot = { x: ev.offsetX, y: ev.offsetY };
      const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
      const next = zoomAtPoint({ zoom, panX, panY }, factor, pivot, basePps, b);
      const clamped = clampPan(next, painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
      zoom = clamped.zoom; panX = clamped.panX; panY = clamped.panY;
      pps = basePps * zoom;
      persistView();
      refresh().catch(console.error);
    } else {
      const dx = ev.shiftKey ? ev.deltaY : ev.deltaX;
      const dy = ev.shiftKey ? 0 : ev.deltaY;
      const next = clampPan(
        { zoom, panX: panX - dx, panY: panY - dy },
        painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps,
      );
      panX = next.panX; panY = next.panY;
      applyView();
      persistView();
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); stepZoom(-1); }
    else if (e.key === '0') { e.preventDefault(); onFit(); }
    else if (e.key === '1') { e.preventDefault(); onResetOneToOne(); }
  }

  function onResize() {
    if (!stage || !painting) return;
    stage.size({ width: host.clientWidth, height: host.clientHeight });
    const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    const clampedZoom = Math.max(b.minZoom, Math.min(b.maxZoom, zoom));
    const clamped = clampPan(
      { zoom: clampedZoom, panX, panY },
      painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps,
    );
    const zoomChanged = clamped.zoom !== zoom;
    zoom = clamped.zoom; panX = clamped.panX; panY = clamped.panY;
    pps = basePps * zoom;
    if (zoomChanged) {
      refresh().catch(console.error);
    } else {
      applyView();
    }
    persistView();
  }

  function setZoom(nextZoom: number, pivot?: { x: number; y: number }) {
    if (!stage || !painting) return;
    const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    const px = pivot?.x ?? stage.width() / 2;
    const py = pivot?.y ?? stage.height() / 2;
    const factor = Math.max(b.minZoom, Math.min(b.maxZoom, nextZoom)) / zoom;
    const next: View = zoomAtPoint({ zoom, panX, panY }, factor, { x: px, y: py }, basePps, b);
    const clamped = clampPan(next, painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    zoom = clamped.zoom; panX = clamped.panX; panY = clamped.panY;
    pps = basePps * zoom;
    persistView();
    refresh().catch(console.error);
  }

  function stepZoom(direction: 1 | -1) {
    setZoom(zoom * (direction === 1 ? 1.25 : 1 / 1.25));
  }

  function onFit() {
    if (!stage || !painting) return;
    const hostW = host.clientWidth;
    const hostH = host.clientHeight;
    if (stage.width() !== hostW || stage.height() !== hostH) {
      stage.size({ width: hostW, height: hostH });
    }
    const v = fitView(painting.canvasW16, painting.canvasH16, hostW, hostH, basePps);
    zoom = v.zoom;
    panX = Math.round(v.panX);
    panY = Math.round(v.panY);
    pps = basePps * zoom;
    persistView();
    refresh().catch(console.error);
  }

  function onResetOneToOne() {
    if (!stage || !painting) return;
    const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    setZoom(Math.max(1, b.minZoom));
  }

  async function refresh() {
    if (!stage || !painting) return;
    mode = 'settled';
    stage.size({ width: host.clientWidth, height: host.clientHeight });
    bgLayer.destroyChildren();
    imageLayer.destroyChildren();
    rasterLayer.destroyChildren();
    overlayLayer.destroyChildren();
    gridLayer.destroyChildren();
    rasterImageNode = null;
    overlayRects = null;
    drawCheckerboard();
    await drawImage();
    drawRasterPreview();
    drawOverlay();
    drawGrid();
    // Re-clamp view in case canvas dimensions or host size changed.
    const b = computeZoomBounds(painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps);
    const reclamped = clampPan(
      { zoom: Math.max(b.minZoom, Math.min(b.maxZoom, zoom)), panX, panY },
      painting.canvasW16, painting.canvasH16, stage.width(), stage.height(), basePps,
    );
    zoom = reclamped.zoom; panX = reclamped.panX; panY = reclamped.panY;
    pps = basePps * zoom;
    applyView();
    bgLayer.draw(); imageLayer.draw(); rasterLayer.draw(); overlayLayer.draw(); gridLayer.draw();
    maybeStartRaster();
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
      updateOverlayGeometry();
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
      keepRatio: true,
      shiftBehavior: 'inverted',
      anchorSize: 10,
      enabledAnchors: ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center'],
    });
    tr.on('transformstart', () => {
      mode = 'live';
      rasterToken++;
      if (rasterImageNode) { rasterImageNode.hide(); rasterLayer.batchDraw(); }
    });
    tr.on('transform', () => {
      updateOverlayGeometry();
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

  function drawOverlay() {
    if (!painting) return;
    const top = new Konva.Rect({ fill: 'white', opacity: 0.6, listening: false });
    const bottom = new Konva.Rect({ fill: 'white', opacity: 0.6, listening: false });
    const left = new Konva.Rect({ fill: 'white', opacity: 0.6, listening: false });
    const right = new Konva.Rect({ fill: 'white', opacity: 0.6, listening: false });
    overlayLayer.add(top, bottom, left, right);
    overlayRects = { top, bottom, left, right };
    updateOverlayGeometry();
  }

  function updateOverlayGeometry() {
    if (!painting || !overlayRects || !imageNode) return;
    const imgX = imageNode.x();
    const imgY = imageNode.y();
    const imgW = imageNode.width() * imageNode.scaleX();
    const imgH = imageNode.height() * imageNode.scaleY();
    const cR = painting.canvasW16 * pps;
    const cB = painting.canvasH16 * pps;
    const imgR = imgX + imgW;
    const imgB = imgY + imgH;

    const topH = Math.max(0, 0 - imgY);
    overlayRects.top.position({ x: imgX, y: imgY });
    overlayRects.top.size({ width: imgW, height: topH });

    const bottomH = Math.max(0, imgB - cB);
    overlayRects.bottom.position({ x: imgX, y: cB });
    overlayRects.bottom.size({ width: imgW, height: bottomH });

    const innerTop = Math.max(imgY, 0);
    const innerBottom = Math.min(imgB, cB);
    const innerH = Math.max(0, innerBottom - innerTop);

    const leftW = Math.max(0, 0 - imgX);
    overlayRects.left.position({ x: imgX, y: innerTop });
    overlayRects.left.size({ width: leftW, height: innerH });

    const rightW = Math.max(0, imgR - cR);
    overlayRects.right.position({ x: cR, y: innerTop });
    overlayRects.right.size({ width: rightW, height: innerH });

    overlayLayer.batchDraw();
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
    const x16 = Math.round(imageNode.x() / pps);
    const y16 = Math.round(imageNode.y() / pps);
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
  {#if painting && stage}
    <CanvasToolbar
      {zoom}
      minZoom={bounds.minZoom}
      maxZoom={bounds.maxZoom}
      onZoomIn={() => stepZoom(1)}
      onZoomOut={() => stepZoom(-1)}
      onSetZoom={(z) => setZoom(z)}
      {onFit}
      {onResetOneToOne}
    />
  {/if}
</div>

<style>
  .canvas-wrap {
    flex: 1;
    padding: var(--space-7);
    background: var(--surface-2);
    min-height: 0;
    position: relative;
  }
  .canvas-host {
    width: 100%; height: 100%;
    background: #fff; border: 1px solid var(--border); border-radius: var(--radius-lg);
    overflow: hidden;
  }
</style>

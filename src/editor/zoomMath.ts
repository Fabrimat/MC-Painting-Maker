export type View = { zoom: number; panX: number; panY: number };
export type Bounds = { minZoom: number; maxZoom: number };

const MAX_ZOOM = 8;
const DEFAULT_MARGIN = 32;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function computeZoomBounds(
  canvasW16: number,
  canvasH16: number,
  hostW: number,
  hostH: number,
  basePps: number,
  margin: number = DEFAULT_MARGIN,
): Bounds {
  const canvasPxW = Math.max(1, canvasW16 * basePps);
  const canvasPxH = Math.max(1, canvasH16 * basePps);
  const fitW = (hostW - 2 * margin) / canvasPxW;
  const fitH = (hostH - 2 * margin) / canvasPxH;
  const fitZoom = Math.max(0.01, Math.min(fitW, fitH));
  const minZoom = Math.min(fitZoom, 1);
  return { minZoom, maxZoom: MAX_ZOOM };
}

export function fitView(
  canvasW16: number,
  canvasH16: number,
  hostW: number,
  hostH: number,
  basePps: number,
  margin: number = DEFAULT_MARGIN,
): View {
  const canvasPxW = Math.max(1, canvasW16 * basePps);
  const canvasPxH = Math.max(1, canvasH16 * basePps);
  const fitW = (hostW - 2 * margin) / canvasPxW;
  const fitH = (hostH - 2 * margin) / canvasPxH;
  const bounds = computeZoomBounds(canvasW16, canvasH16, hostW, hostH, basePps, margin);
  const zoom = clamp(Math.min(fitW, fitH), bounds.minZoom, bounds.maxZoom);
  const panX = (hostW - canvasPxW * zoom) / 2;
  const panY = (hostH - canvasPxH * zoom) / 2;
  return { zoom, panX, panY };
}

export function zoomAtPoint(
  current: View,
  factor: number,
  pivot: { x: number; y: number },
  basePps: number,
  bounds: Bounds,
): View {
  const oldPps = basePps * current.zoom;
  const worldX = (pivot.x - current.panX) / oldPps;
  const worldY = (pivot.y - current.panY) / oldPps;
  const zoom = clamp(current.zoom * factor, bounds.minZoom, bounds.maxZoom);
  const newPps = basePps * zoom;
  const panX = pivot.x - worldX * newPps;
  const panY = pivot.y - worldY * newPps;
  return { zoom, panX, panY };
}

export function clampPan(
  view: View,
  canvasW16: number,
  canvasH16: number,
  hostW: number,
  hostH: number,
  basePps: number,
  minVisible: number = 64,
): View {
  const canvasPxW = canvasW16 * basePps * view.zoom;
  const canvasPxH = canvasH16 * basePps * view.zoom;
  // Keep at least minVisible px of the canvas inside the host on each axis.
  // Canvas spans [panX, panX + canvasPxW] on screen.
  // Overlap with host [0, hostW] is at least minVisible iff:
  //   panX <= hostW - minVisible  (canvas not scrolled entirely past the right edge)
  //   panX + canvasPxW >= minVisible  (canvas not scrolled entirely past the left edge)
  // i.e. panX in [minVisible - canvasPxW, hostW - minVisible].
  const minPanX = minVisible - canvasPxW;
  const maxPanX = hostW - minVisible;
  const minPanY = minVisible - canvasPxH;
  const maxPanY = hostH - minVisible;
  return {
    zoom: view.zoom,
    panX: clamp(view.panX, Math.min(minPanX, maxPanX), Math.max(minPanX, maxPanX)),
    panY: clamp(view.panY, Math.min(minPanY, maxPanY), Math.max(minPanY, maxPanY)),
  };
}

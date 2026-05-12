export type AddSource = 'drop' | 'paste' | 'file-handler' | 'share-target' | 'button';
export type ImportSource = 'json' | AddSource;
export type BuildReason = 'archive-error' | 'image-encode' | 'other';
export type ImportReason = 'json-parse' | 'image-decode' | 'no-valid-files' | 'idb-read' | 'other';

function dispatch(name: string, metadata?: Record<string, unknown>): void {
  if (typeof window.sa_event !== 'function') return;
  window.sa_event(name, metadata);
}

export function trackPaintingsAdded(source: AddSource, count: number): void {
  dispatch('painting_added', { source, count });
}

export function trackMcaddonBuilt(paintings: number): void {
  dispatch('mcaddon_built', { paintings });
}

export function trackBuildFailed(reason: BuildReason): void {
  dispatch('build_failed', { reason });
}

export function trackProjectExported(paintings: number): void {
  dispatch('project_exported', { paintings });
}

export function trackProjectImported(paintings: number): void {
  dispatch('project_imported', { paintings });
}

export function trackImportFailed(source: ImportSource, reason: ImportReason): void {
  dispatch('import_failed', { source, reason });
}

export function trackPwaInstallAvailable(): void {
  dispatch('pwa_install_available');
}

export function trackPwaInstalled(): void {
  dispatch('pwa_installed');
}

export function classifyBuildReason(err: unknown): BuildReason {
  const msg = (err instanceof Error ? err.message : '').toLowerCase();
  if (msg.includes('zip') || msg.includes('archive') || msg.includes('deflate') || msg.includes('inflate')) return 'archive-error';
  if (msg.includes('image') || msg.includes('decode') || msg.includes('encode') || msg.includes('bitmap')) return 'image-encode';
  return 'other';
}

export function classifyImportReason(err: unknown): ImportReason {
  const msg = (err instanceof Error ? err.message : '').toLowerCase();
  if (msg.includes('json')) return 'json-parse';
  if (msg.includes('image') || msg.includes('decode') || msg.includes('bitmap')) return 'image-decode';
  return 'other';
}

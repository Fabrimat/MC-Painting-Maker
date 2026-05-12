export type AddSource = 'drop' | 'paste' | 'file-handler' | 'share-target' | 'button';
export type ImportSource = 'json' | AddSource;
export type BuildReason = 'jszip-error' | 'image-encode' | 'manifest-invalid' | 'other';
export type ImportReason = 'json-parse' | 'image-decode' | 'no-valid-files' | 'idb-read' | 'other';

type SaEvent = (name: string, metadata?: Record<string, unknown>) => void;

function dispatch(name: string, metadata?: Record<string, unknown>): void {
  const fn = (window as unknown as { sa_event?: SaEvent }).sa_event;
  if (typeof fn !== 'function') return;
  fn(name, metadata);
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

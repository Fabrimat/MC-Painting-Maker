import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as track from './track';

describe('analytics/track', () => {
  let saEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    saEvent = vi.fn();
    vi.stubGlobal('sa_event', saEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trackPaintingsAdded dispatches painting_added with source and count', () => {
    track.trackPaintingsAdded('drop', 3);
    expect(saEvent).toHaveBeenCalledTimes(1);
    expect(saEvent).toHaveBeenCalledWith('painting_added', { source: 'drop', count: 3 });
  });

  it('trackMcaddonBuilt dispatches mcaddon_built with paintings count', () => {
    track.trackMcaddonBuilt(7);
    expect(saEvent).toHaveBeenCalledTimes(1);
    expect(saEvent).toHaveBeenCalledWith('mcaddon_built', { paintings: 7 });
  });

  it('trackBuildFailed dispatches build_failed with reason', () => {
    track.trackBuildFailed('jszip-error');
    expect(saEvent).toHaveBeenCalledTimes(1);
    expect(saEvent).toHaveBeenCalledWith('build_failed', { reason: 'jszip-error' });
  });

  it('trackProjectExported dispatches project_exported with paintings count', () => {
    track.trackProjectExported(5);
    expect(saEvent).toHaveBeenCalledTimes(1);
    expect(saEvent).toHaveBeenCalledWith('project_exported', { paintings: 5 });
  });

  it('trackProjectImported dispatches project_imported with paintings count', () => {
    track.trackProjectImported(4);
    expect(saEvent).toHaveBeenCalledTimes(1);
    expect(saEvent).toHaveBeenCalledWith('project_imported', { paintings: 4 });
  });

  it('trackImportFailed dispatches import_failed with source and reason', () => {
    track.trackImportFailed('share-target', 'idb-read');
    expect(saEvent).toHaveBeenCalledTimes(1);
    expect(saEvent).toHaveBeenCalledWith('import_failed', { source: 'share-target', reason: 'idb-read' });
  });

  it('trackPwaInstallAvailable dispatches pwa_install_available with no metadata', () => {
    track.trackPwaInstallAvailable();
    expect(saEvent).toHaveBeenCalledTimes(1);
    expect(saEvent).toHaveBeenCalledWith('pwa_install_available', undefined);
  });

  it('trackPwaInstalled dispatches pwa_installed with no metadata', () => {
    track.trackPwaInstalled();
    expect(saEvent).toHaveBeenCalledTimes(1);
    expect(saEvent).toHaveBeenCalledWith('pwa_installed', undefined);
  });

  it('is a silent no-op when window.sa_event is undefined', () => {
    vi.unstubAllGlobals();
    expect(() => track.trackPaintingsAdded('drop', 1)).not.toThrow();
    expect(() => track.trackMcaddonBuilt(1)).not.toThrow();
    expect(() => track.trackBuildFailed('other')).not.toThrow();
    expect(() => track.trackProjectExported(0)).not.toThrow();
    expect(() => track.trackProjectImported(0)).not.toThrow();
    expect(() => track.trackImportFailed('json', 'other')).not.toThrow();
    expect(() => track.trackPwaInstallAvailable()).not.toThrow();
    expect(() => track.trackPwaInstalled()).not.toThrow();
  });
});

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
    track.trackBuildFailed('archive-error');
    expect(saEvent).toHaveBeenCalledTimes(1);
    expect(saEvent).toHaveBeenCalledWith('build_failed', { reason: 'archive-error' });
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

  it('trackDebugModeChanged dispatches debug_mode_changed with enabled flag', () => {
    track.trackDebugModeChanged(true);
    expect(saEvent).toHaveBeenLastCalledWith('debug_mode_changed', { enabled: true });
    track.trackDebugModeChanged(false);
    expect(saEvent).toHaveBeenLastCalledWith('debug_mode_changed', { enabled: false });
    expect(saEvent).toHaveBeenCalledTimes(2);
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
    expect(() => track.trackDebugModeChanged(true)).not.toThrow();
    expect(saEvent).not.toHaveBeenCalled();
  });

  describe('classifyBuildReason', () => {
    it('returns "archive-error" when message contains "zip"', () => {
      expect(track.classifyBuildReason(new Error('Failed to zip directory'))).toBe('archive-error');
    });

    it('returns "archive-error" when message contains "archive", "deflate", or "inflate"', () => {
      expect(track.classifyBuildReason(new Error('archive corruption'))).toBe('archive-error');
      expect(track.classifyBuildReason(new Error('deflate failed'))).toBe('archive-error');
      expect(track.classifyBuildReason(new Error('inflate stream error'))).toBe('archive-error');
    });

    it('returns "image-encode" when message mentions image, decode, encode, or bitmap', () => {
      expect(track.classifyBuildReason(new Error('Failed to encode image'))).toBe('image-encode');
      expect(track.classifyBuildReason(new Error('decode error'))).toBe('image-encode');
      expect(track.classifyBuildReason(new Error('createImageBitmap failed'))).toBe('image-encode');
    });

    it('returns "other" when message does not match any known pattern', () => {
      expect(track.classifyBuildReason(new Error('something unexpected'))).toBe('other');
      expect(track.classifyBuildReason(new Error('manifest is invalid'))).toBe('other');
    });

    it('returns "other" when err is not an Error instance', () => {
      expect(track.classifyBuildReason('a string')).toBe('other');
      expect(track.classifyBuildReason(undefined)).toBe('other');
      expect(track.classifyBuildReason({ message: 'zip' })).toBe('other');
    });
  });

  describe('classifyImportReason', () => {
    it('returns "json-parse" when message contains "json"', () => {
      expect(track.classifyImportReason(new Error('Invalid JSON at position 5'))).toBe('json-parse');
    });

    it('returns "image-decode" when message mentions image, decode, or bitmap', () => {
      expect(track.classifyImportReason(new Error('image decode failed'))).toBe('image-decode');
      expect(track.classifyImportReason(new Error('bitmap unsupported'))).toBe('image-decode');
    });

    it('returns "other" when message does not match any known pattern', () => {
      expect(track.classifyImportReason(new Error('disk full'))).toBe('other');
    });

    it('returns "other" when err is not an Error instance', () => {
      expect(track.classifyImportReason(undefined)).toBe('other');
    });
  });
});

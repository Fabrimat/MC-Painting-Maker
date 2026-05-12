import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { initInstallTracking } from './installTracking';

describe('pwa/installTracking', () => {
  let saEvent: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    // Singleton init: registers listeners once for the whole test file.
    initInstallTracking();
  });

  beforeEach(() => {
    saEvent = vi.fn();
    vi.stubGlobal('sa_event', saEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires pwa_install_available when beforeinstallprompt dispatches', () => {
    window.dispatchEvent(new Event('beforeinstallprompt'));
    expect(saEvent).toHaveBeenCalledWith('pwa_install_available', undefined);
  });

  it('fires pwa_installed when appinstalled dispatches', () => {
    window.dispatchEvent(new Event('appinstalled'));
    expect(saEvent).toHaveBeenCalledWith('pwa_installed', undefined);
  });

  it('does not double-register listeners across multiple init calls', () => {
    initInstallTracking();
    initInstallTracking();
    window.dispatchEvent(new Event('beforeinstallprompt'));
    expect(saEvent).toHaveBeenCalledTimes(1);
  });
});

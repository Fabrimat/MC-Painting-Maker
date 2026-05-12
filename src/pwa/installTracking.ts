import { trackPwaInstallAvailable, trackPwaInstalled } from '../analytics/track';

let initialized = false;

export function initInstallTracking(): void {
  if (initialized) return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', trackPwaInstallAvailable);
  window.addEventListener('appinstalled', trackPwaInstalled);
}

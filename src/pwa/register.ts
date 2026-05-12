import { writable, type Writable } from 'svelte/store';
import { registerSW } from 'virtual:pwa-register';

export const needRefresh: Writable<boolean> = writable(false);
export const offlineReady: Writable<boolean> = writable(false);

const updateSW = registerSW({
  onNeedRefresh() {
    needRefresh.set(true);
  },
  onOfflineReady() {
    offlineReady.set(true);
  },
  onRegisterError(error) {
    console.warn('Service worker registration failed', error);
  },
});

export function applyUpdate(): void {
  void updateSW(true);
}

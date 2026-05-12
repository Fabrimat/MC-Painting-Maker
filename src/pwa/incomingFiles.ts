import { writable, type Writable } from 'svelte/store';
import { getShareFiles, deleteShareFiles } from './idb';

export const incomingFiles: Writable<File[] | null> = writable(null);
export const incomingError: Writable<string | null> = writable(null);

function isAcceptedImage(f: File): boolean {
  return f.type === 'image/png' || /^image\/jpe?g$/.test(f.type);
}

function cleanSourceQueryParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('source');
  url.searchParams.delete('error');
  const next = url.pathname + (url.search ? url.search : '') + url.hash;
  window.history.replaceState(window.history.state, '', next);
}

async function consumeShareTarget(error: boolean): Promise<void> {
  if (error) {
    incomingError.set('Share failed');
    cleanSourceQueryParam();
    return;
  }
  try {
    const files = await getShareFiles();
    await deleteShareFiles();
    cleanSourceQueryParam();
    if (!files) return;
    const accepted = files.filter(isAcceptedImage);
    if (accepted.length > 0) incomingFiles.set(accepted);
  } catch {
    incomingError.set('Share failed');
    cleanSourceQueryParam();
  }
}

function registerLaunchQueueConsumer(): void {
  const lq = (window as unknown as {
    launchQueue?: {
      setConsumer: (cb: (params: {
        files: Array<{ getFile: () => Promise<File> }>;
      }) => unknown) => void;
    };
  }).launchQueue;
  if (!lq) return;
  lq.setConsumer(async (params) => {
    const handles = params.files ?? [];
    const files = await Promise.all(handles.map((h) => h.getFile()));
    const accepted = files.filter(isAcceptedImage);
    if (accepted.length > 0) incomingFiles.set(accepted);
  });
}

export function initIncomingFiles(): void {
  const params = new URL(window.location.href).searchParams;
  const source = params.get('source');
  if (source === 'share-target') {
    void consumeShareTarget(params.get('error') === '1');
  }
  registerLaunchQueueConsumer();
}

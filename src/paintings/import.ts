import type { ProjectState, Painting, Source } from './types';
import { createPaintingFromImage, ensurePackUUIDs, MAX_PROJECT_VERSION } from './defaults';
import { devLog } from '../util/devlog';

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function fileDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const v = String(fr.result);
      const idx = v.indexOf(',');
      resolve(idx >= 0 ? v.slice(idx + 1) : v);
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(f);
  });
}

async function decodeOne(f: File): Promise<Source> {
  const dataUrl = await fileDataUrl(f);
  const bmp = await createImageBitmap(f);
  return { pngBase64: dataUrl, naturalW: bmp.width || 1, naturalH: bmp.height || 1 };
}

export type AddImagesResult = {
  state: ProjectState;
  addedIds: string[];
};

export async function addImagesToProject(
  state: ProjectState,
  files: FileList | File[],
): Promise<AddImagesResult> {
  const arr = Array.from(files);
  if (arr.length === 0) return { state, addedIds: [] };
  devLog('import', 'addImagesToProject start', {
    count: arr.length,
    files: arr.map((f) => ({ name: f.name, type: f.type, size: f.size })),
  });
  const additions: Painting[] = [];
  for (const f of arr) {
    const src = await decodeOne(f);
    additions.push(createPaintingFromImage(stripExt(f.name), src));
  }
  const withUuids = ensurePackUUIDs(state);
  // Empty legacy projects (v2 from a localStorage carryover) can safely
  // adopt the latest schema at this point: there is no painting yet, so
  // no item identifier exists to invalidate in already-imported worlds.
  // Once the first painting is loaded we lock the version, mirroring the
  // policy in migrate(): keep existing addons reproducible.
  const versionBumped = withUuids.paintings.length === 0 && withUuids.version !== MAX_PROJECT_VERSION
    ? { ...withUuids, version: MAX_PROJECT_VERSION }
    : withUuids;
  devLog('import', 'addImagesToProject done', {
    added: additions.length,
    totalPaintings: versionBumped.paintings.length + additions.length,
    version: versionBumped.version,
    bumped: versionBumped !== withUuids,
  });
  return {
    state: { ...versionBumped, paintings: [...versionBumped.paintings, ...additions] },
    addedIds: additions.map((p) => p.id),
  };
}

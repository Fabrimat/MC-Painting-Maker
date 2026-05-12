import type { ProjectState, Painting, Source } from './types';
import { createPaintingFromImage, ensurePackUUIDs } from './defaults';

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
  const additions: Painting[] = [];
  for (const f of arr) {
    const src = await decodeOne(f);
    additions.push(createPaintingFromImage(stripExt(f.name), src));
  }
  const withUuids = ensurePackUUIDs(state);
  return {
    state: { ...withUuids, paintings: [...withUuids.paintings, ...additions] },
    addedIds: additions.map((p) => p.id),
  };
}

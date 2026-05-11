import { zipSync, strToU8 } from 'fflate';
import type { ProjectState, Painting } from '../paintings/types';
import { ensurePackUUIDs } from '../paintings/defaults';
import { rasterize } from '../paintings/rasterize';
import { buildBpManifest, buildRpManifest } from './manifest';
import { buildEntityBehavior } from './entity';
import { buildClientEntity } from './client_entity';
import { buildGeometry } from './geometry';
import { buildRenderController } from './render_controller';
import { buildItemTexture } from './item_texture';
import { buildCatalog } from './catalog';
import { buildBpLang, buildRpLang, LANGUAGES_JSON } from './lang';
import { buildMainJs } from './script';
import { paintingFileBase } from './identifiers';
import { base64ToUint8 } from '../util/base64';
import { buildBackTexturePng, BACK_TEXTURE_FILENAME } from './back_texture';
import { buildBackRenderController } from './back_render_controller';

export type Textures = { texture: Uint8Array; eggTexture: Uint8Array };

function json(obj: unknown): Uint8Array {
  return strToU8(JSON.stringify(obj, null, 2));
}

export async function assembleArchive(
  state: ProjectState,
  textures: Map<string, Textures>,
  backTexture: Uint8Array,
): Promise<Uint8Array> {
  const ns = state.pack.namespace;
  const bp = `BP_${ns}/`;
  const rp = `RP_${ns}/`;
  const files: Record<string, Uint8Array> = {};

  files[`${bp}manifest.json`] = json(buildBpManifest(state));
  files[`${bp}scripts/main.js`] = strToU8(buildMainJs(ns));
  files[`${bp}texts/en_US.lang`] = strToU8(buildBpLang(state));
  files[`${bp}texts/languages.json`] = strToU8(LANGUAGES_JSON);
  const cat = buildCatalog(state);
  if (cat) files[`${bp}item_catalog/crafting_item_catalog.json`] = json(cat);
  if (state.pack.iconPngBase64) {
    files[`${bp}pack_icon.png`] = base64ToUint8(state.pack.iconPngBase64);
  }
  for (const p of state.paintings) {
    const fb = paintingFileBase(p.id);
    files[`${bp}entities/${fb}.behavior.json`] = json(buildEntityBehavior(state, p));
  }

  files[`${rp}manifest.json`] = json(buildRpManifest(state));
  files[`${rp}texts/en_US.lang`] = strToU8(buildRpLang(state));
  files[`${rp}texts/languages.json`] = strToU8(LANGUAGES_JSON);
  files[`${rp}textures/item_texture.json`] = json(buildItemTexture(state));
  if (state.pack.iconPngBase64) {
    files[`${rp}pack_icon.png`] = base64ToUint8(state.pack.iconPngBase64);
  }
  for (const p of state.paintings) {
    const fb = paintingFileBase(p.id);
    files[`${rp}entity/${fb}.entity.json`] = json(buildClientEntity(state, p));
    files[`${rp}models/entity/${fb}.geo.json`] = json(buildGeometry(p));
    files[`${rp}render_controllers/${fb}.rc.json`] = json(buildRenderController(p));
    const tx = textures.get(p.id);
    if (tx) {
      files[`${rp}textures/entity/${fb}.png`] = tx.texture;
      files[`${rp}textures/items/${fb}_egg.png`] = tx.eggTexture;
    }
  }

  // Pack-shared back texture + render controller
  files[`${rp}textures/entity/${BACK_TEXTURE_FILENAME}.png`] = backTexture;
  files[`${rp}render_controllers/${BACK_TEXTURE_FILENAME}.rc.json`] = json(buildBackRenderController());

  return zipSync(files);
}

export function archiveFilename(state: ProjectState): string {
  const safe = state.pack.name.replace(/[^a-zA-Z0-9_\- ]+/g, '').trim() || 'paintings';
  return `${safe}.mcaddon`;
}

function fitContain(p: Painting, w16: number, h16: number) {
  if (!p.source) {
    return { x16: 0, y16: 0, w16, h16, rotation: 0 as const, flipX: false, flipY: false };
  }
  const srcRatio = p.source.naturalW / p.source.naturalH;
  const dstRatio = w16 / h16;
  let dw: number, dh: number;
  if (srcRatio >= dstRatio) {
    dw = w16;
    dh = Math.max(1, Math.round(w16 / srcRatio));
  } else {
    dh = h16;
    dw = Math.max(1, Math.round(h16 * srcRatio));
  }
  return {
    x16: Math.round((w16 - dw) / 2),
    y16: Math.round((h16 - dh) / 2),
    w16: dw, h16: dh, rotation: 0 as const, flipX: false, flipY: false,
  };
}

async function rasterizeEgg(p: Painting): Promise<Uint8Array> {
  const eggPainting: Painting = {
    ...p,
    canvasW16: 16,
    canvasH16: 16,
    textureDensity: 1,
    transform: fitContain(p, 16, 16),
  };
  return await rasterize(eggPainting);
}

export async function buildMcaddonBlob(state: ProjectState): Promise<Blob> {
  // Defensive: if the caller somehow gets here with empty UUIDs (e.g. a project loaded
  // from an external JSON that predates ensurePackUUIDs), populate them now.
  const ready = ensurePackUUIDs(state);
  const textures = new Map<string, Textures>();
  for (const p of ready.paintings) {
    const texture = await rasterize(p);
    const eggTexture = await rasterizeEgg(p);
    textures.set(p.id, { texture, eggTexture });
  }
  const backTexture = await buildBackTexturePng();
  const bytes = await assembleArchive(ready, textures, backTexture);
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
}

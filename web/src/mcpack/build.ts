import { zipSync, strToU8 } from 'fflate';
import type { ProjectState } from '../paintings/types';
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

export type Textures = { texture: Uint8Array; eggTexture: Uint8Array };

function json(obj: unknown): Uint8Array {
  return strToU8(JSON.stringify(obj, null, 2));
}

export async function assembleArchive(
  state: ProjectState,
  textures: Map<string, Textures>,
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

  return zipSync(files);
}

export function archiveFilename(state: ProjectState): string {
  const safe = state.pack.name.replace(/[^a-zA-Z0-9_\- ]+/g, '').trim() || 'paintings';
  return `${safe}.mcaddon`;
}

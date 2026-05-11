# MC Painting Maker — Design

**Date:** 2026-05-11
**Status:** Approved (brainstorming phase)

## 1. Purpose

A browser-based tool that takes user-uploaded images and produces a Minecraft Bedrock / Education `.mcaddon` containing one custom independent entity per image. Each entity is rendered as a flat painting that the player places on a wall via a vanilla spawn egg with a custom icon.

The tool runs entirely client-side, has no backend, and is deployable to GitHub Pages.

## 2. Scope and constraints

### In scope
- Web UI: batch image upload, per-painting editor with grid overlay, per-painting size in blocks (1/16-block snap), image crop/translate/scale, canvas resize that adds invisible space or trims the image.
- Output: a single `.mcaddon` file containing a Behavior Pack (BP) and a Resource Pack (RP).
- Each painting is an independent custom entity with its own geometry, texture, render controller, and client_entity definition.
- Spawn egg: vanilla style, with custom texture per entity (= preview of the painting). Custom collapsible group inside the existing `equipment` creative category.
- Visual wall-snap: painting orients to the nearest cardinal direction (N/S/E/W) regardless of player facing at spawn time.
- Auto-save to `localStorage`, plus JSON export/import for project portability.
- Pack metadata: name, description, namespace, semver, min engine version, optional pack icon.
- Only English (`en_US`) at launch; structure makes adding more locales trivial.

### Out of scope (explicit YAGNI)
- Floor/ceiling placement (walls only).
- Free-angle rotation (only 0°/90°/180°/270° flips/rotations on the source).
- Color filters / brightness / contrast (user applies them upstream).
- Animated paintings (static only).
- IndexedDB (localStorage is enough at expected pack sizes).
- WebWorker for packaging (only if profiling shows it is needed later).
- Sample world bundled inside the `.mcaddon`.
- Custom block / placeable block placement (vanilla spawn egg only).
- Sharing / cloud sync / accounts (everything is local).

### Non-functional constraints
- All processing client-side. No HTTP calls at runtime.
- Static build (Vite output) deployable to GitHub Pages.
- Public repository: all source and docs in English, no co-authoring lines in commits.
- Reference repo `vatican` uses Regolith + System Template — we deliberately do not.

## 3. Technology stack

| Concern | Choice |
| --- | --- |
| Build tool | Vite |
| UI framework | Svelte |
| Language | TypeScript (strict) |
| Canvas editor | Konva.js (Stage + Layer + Transformer) |
| Zip generation | `fflate` (used by JSZip and standalone; we pick `fflate` directly for smaller bundle and speed) |
| Image encoding | `OffscreenCanvas.convertToBlob({ type: 'image/png' })` |
| Validation | `zod` for project schema |
| Testing | `vitest` + `@testing-library/svelte` |
| Deploy | GitHub Actions → GitHub Pages |

No backend, no server, no analytics.

## 4. High-level architecture

```
Repo MC-Painting-Maker
├─ web/                                 ← Vite + Svelte + TS (static, GH Pages)
│  ├─ src/
│  │  ├─ App.svelte                     ← layout: sidebar | editor | pack panel
│  │  ├─ stores/
│  │  │  ├─ project.ts                  ← global Svelte store (ProjectState)
│  │  │  └─ persistence.ts              ← debounced localStorage + import/export
│  │  ├─ editor/
│  │  │  ├─ PaintingEditor.svelte       ← Konva stage, transformer, toolbar
│  │  │  ├─ GridLayer.ts                ← block lines + 1/16 sub-block lines
│  │  │  └─ CanvasResizer.ts            ← edge/corner handles that grow/trim canvas
│  │  ├─ paintings/
│  │  │  ├─ types.ts                    ← Painting, ProjectState, PackMeta
│  │  │  ├─ schema.ts                   ← zod schemas (validation)
│  │  │  └─ rasterize.ts                ← state → PNG bytes (OffscreenCanvas)
│  │  ├─ mcpack/
│  │  │  ├─ build.ts                    ← orchestrates the .mcaddon zip
│  │  │  ├─ manifest.ts                 ← BP/RP manifest.json + stable UUIDs
│  │  │  ├─ entity.ts                   ← per-painting BP entity JSON
│  │  │  ├─ client_entity.ts            ← per-painting RP entity JSON
│  │  │  ├─ geometry.ts                 ← per-painting geo.json
│  │  │  ├─ render_controller.ts        ← per-painting RC (standard, no arrays)
│  │  │  ├─ animation.ts                ← single shared wall-snap animation
│  │  │  ├─ animation_controller.ts     ← single shared wall-snap AC
│  │  │  ├─ item_texture.ts             ← RP item_texture.json
│  │  │  ├─ catalog.ts                  ← BP crafting_item_catalog.json
│  │  │  └─ lang.ts                     ← BP + RP en_US.lang
│  │  └─ ui/                            ← generic components (Button, FileDrop, Modal)
│  ├─ index.html, vite.config.ts, package.json, tsconfig.json
│
├─ docs/superpowers/                    ← spec + plan (this file is here)
├─ test_painting.geo.json               ← reference (NOT modified)
├─ texture.png                          ← reference (NOT modified)
├─ .github/workflows/pages.yml          ← deploy on push to main
└─ README.md
```

### Module boundaries (separation of concerns)

- `paintings/` knows the data model and how to rasterize; knows nothing about Bedrock JSON or UI.
- `mcpack/` consumes a pure `ProjectState` (+ rendered PNG bytes) and produces a `Blob`. Knows nothing about Svelte/UI.
- `editor/` manipulates the Konva canvas based on the store; knows nothing about `mcpack`.

This is what makes `mcpack/` unit-testable in vitest with no DOM mocks.

### Data flow

```
File drop (PNG/JPEG)
   ↓ createImageBitmap + base64-encode
Painting state added to ProjectState (Svelte store)
   ↔ persistence.ts ⇄ localStorage (debounced 1s)
   ↓
PaintingEditor (Konva) ← user edits → store
   ↓ on Build clicked
rasterize.ts: ProjectState → Map<paintingId, Uint8Array (PNG)>
   ↓
mcpack/build.ts: ProjectState + rasterized PNGs → fflate.zipSync → Blob
   ↓
Browser download as <pack-name>.mcaddon
```

## 5. Data model

All units inside the data model are integers in 1/16-block space, to avoid float drift. The UI translates to/from blocks (`value / 16`).

```ts
type ProjectState = {
  version: 1;                         // schema version, used for migration
  pack: PackMeta;
  uuids: PackUUIDs;                   // stable across re-exports
  paintings: Painting[];              // order = creative-inventory order
};

type PackMeta = {
  name: string;                       // shown in pack list
  description: string;
  namespace: string;                  // [a-z][a-z0-9_]{0,15}, not 'minecraft'
  semver: [number, number, number];   // [1, 0, 0]
  minEngineVersion: [number, number, number];  // [1, 21, 0]
  iconPngBase64: string | null;       // pack_icon.png; null → placeholder generated
  creativeGroupName: string;          // shown on hover in creative tab
};

type PackUUIDs = {
  bpHeader: string;                   // uuidv4
  bpModule: string;
  rpHeader: string;
  rpModule: string;
};

type Painting = {
  id: string;                         // uuidv4 (stored raw, e.g. "a3f8-12...-...")
                                       // sanitized form (hyphens → underscores) is used
                                       // wherever a Bedrock identifier must match
                                       // /[a-z0-9_]+/, i.e. file names and identifiers.
  name: string;                       // display name (spawn egg + entity)

  canvasW16: number;                  // canvas width in 1/16-block units
  canvasH16: number;                  // canvas height in 1/16-block units

  source: {
    pngBase64: string;                // original PNG/JPEG re-encoded as PNG
    naturalW: number;                 // pixels
    naturalH: number;                 // pixels
  } | null;

  transform: {
    x16: number;                      // image top-left X within canvas (1/16 units)
    y16: number;                      // image top-left Y within canvas (1/16 units)
    w16: number;                      // rendered width in 1/16 units
    h16: number;                      // rendered height in 1/16 units
    rotation: 0 | 90 | 180 | 270;     // discrete rotation
    flipX: boolean;
    flipY: boolean;
  };

  resampling: 'smooth' | 'pixelated'; // downsampling mode
  textureDensity: 'auto' | 1 | 2 | 4 | 8 | 16 | 32 | 64;
                                       // texture pixels per 1/16 block
                                       // 'auto' = min density to not upscale source
  material: 'alphatest' | 'alphablend'; // default 'alphatest'
};
```

### Design decisions

- **1/16-block integer units** internally → no rounding drift; the entire snap-to-1/16 invariant is enforced by the type itself.
- **Source PNG is immutable** after upload. All edits live in `transform`; they are non-destructive.
- **Discrete rotation** (0/90/180/270) avoids diagonal sampling and keeps the painting aligned with the pixel grid. If free rotation is ever needed, extend later.
- **`textureDensity: 'auto'`** picks `nextPow2(max(srcW / w16, srcH / h16))`, clamped to `[1, 64]`. Example: a 1000×1000 source in `w16=16` (1 block) → ceil(62.5) → next pow2 = 64 → texture 1024×1024 px.
- **Stable UUIDs** generated once and persisted: re-exporting from the same project produces the same pack identity so end-users can update without re-installing.

## 6. Editor UX

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◀ Paintings │              [ Painting "Sunset" ]                              │
├─────────────┼──────────────────────────────────────────────────────────────────┤
│ + Add file  │  Canvas: [ 2.5 ] W × [ 3.0 ] H blocks   ⊓ Lock ratio              │
│ ─────       │  Density: [ Auto (64×) ▾ ]   Resampling: ( smooth | pixelated )  │
│ ☐ Sunset    │  Material: ( alphatest | alphablend )                            │
│   2.5×3     │                                                                  │
│ ☐ Logo      │   ┌────┬────┬────┐ ... block lines (thick)                        │
│   1×1       │   │ ░░░░ image ░░░│ ... 1/16 sub-lines (thin, zoomed-in only)    │
│             │   ├────┼────┼────┤                                                │
│             │   │ ░░░░░░░░░░░░░░│                                                │
│             │   └────┴────┴────┘ ← canvas resize handles on the canvas borders  │
│             │                                                                  │
│             │  [ Replace image ] [ Reset transform ] [ Rotate 90° ] [ Flip ]   │
│             │  Display name: [ Sunset                                       ]  │
│             │                                                                  │
│             │  ⚠ Final texture: 160×192 px (2.5×3 blocks, density 64×)         │
└─────────────┴──────────────────────────────────────────────────────────────────┘
                              [ Build .mcaddon ] [ Export JSON ] [ Import JSON ]
```

### Interactions (Konva stage)

| Action | Mechanism |
| --- | --- |
| Drag image | Click+drag the image node. Snaps to 1/16 block on `dragmove`. |
| Scale image | Corner/edge handles via Konva `Transformer`. Snap to 1/16. Shift = preserve aspect. |
| Resize canvas | Separate handles on the canvas border (custom `CanvasResizer`); dragging outward adds transparent space, inward trims the image. Numeric inputs in the toolbar are the alternative. |
| Pan view | Spacebar + drag, or trackpad pan. |
| Zoom view | Ctrl/Cmd + wheel, or pinch. Reveals 1/16 grid above a zoom threshold. |
| Reset transform | Button → image fits canvas with `contain` (preserves aspect ratio). |
| Drag-drop source | Drop a PNG over the editor to replace the source. |

### Grid layer

- **Block lines** (every 16 units): stroke 2 px, high contrast.
- **1/16 lines** (every 1 unit): stroke 1 px, low opacity. Only drawn when zoom > 1.5× to keep visuals clean.
- **Canvas background**: checkerboard pattern indicating transparency.
- **Out-of-canvas overlay**: anything outside the canvas rectangle is dimmed → clear visual boundary of what becomes texture.

### Snap to 1/16

- Konva coordinates are in pixels (with zoom factor). On `dragmove`/`transform`, the editor rounds: `Math.round(coord / pxPerSixteenth) * pxPerSixteenth`, then writes back to the store in integer 1/16-block units.

### Batch flow

- Dropping multiple files = creates N paintings: name from filename, initial canvas derived from source aspect ratio (snapped to 1/16, default max 4 blocks on the longest side).
- Sidebar list: thumbnail + dimensions; click to edit; drag to reorder (defines creative-inventory order and which painting is the group icon); multi-select for batch delete/duplicate.

### Non-blocking warnings (toolbar status)

- Texture > 1024 px per side → "Painting is very large; may cause lag in-game."
- Canvas more than X% transparent → "X% of the texture is transparent — confirm intentional."
- Duplicate display names → "Multiple paintings share this name (identifiers stay unique)."

## 7. Texture rasterization

For each painting we produce a single PNG sized `canvasW16 × density × canvasH16 × density` pixels.

```ts
async function rasterize(p: Painting): Promise<Uint8Array> {
  const density = resolveDensity(p);              // 'auto' → nextPow2(...)
  const W = p.canvasW16 * density;
  const H = p.canvasH16 * density;
  const cvs = new OffscreenCanvas(W, H);
  const ctx = cvs.getContext('2d')!;
  // Empty canvas is already alpha=0 everywhere.
  if (!p.source) return await encodePng(cvs);

  const bmp = await createImageBitmap(base64ToBlob(p.source.pngBase64));

  ctx.save();
  ctx.imageSmoothingEnabled  = p.resampling === 'smooth';
  ctx.imageSmoothingQuality  = 'high';
  applyTransform(ctx, p.transform, density);      // scales 1/16 units → pixels
  ctx.drawImage(bmp, 0, 0, p.transform.w16 * density, p.transform.h16 * density);
  ctx.restore();

  return await encodePng(cvs);                    // OffscreenCanvas.convertToBlob
}
```

### Spawn-egg preview

- 16×16 PNG.
- Same rasterization pipeline with `canvasW16=16, canvasH16=16, density=1` and the painting's image fitted `contain` inside.
- Saved as `textures/items/painting_<id>_egg.png`.

## 8. `.mcaddon` structure

```
<pack-name>.mcaddon  (zip)
├─ BP_<namespace>/                       ← Behavior Pack
│  ├─ manifest.json                      ← BP UUIDs, depends on RP
│  ├─ pack_icon.png                      ← if provided
│  ├─ entities/
│  │  ├─ painting_<id1>.behavior.json
│  │  └─ ...                             ← ONE per painting
│  ├─ item_catalog/
│  │  └─ crafting_item_catalog.json      ← custom group inside `equipment`
│  └─ texts/
│     ├─ en_US.lang                      ← painting names + group name
│     └─ languages.json                  ← ["en_US"]
│
└─ RP_<namespace>/                       ← Resource Pack
   ├─ manifest.json                      ← RP UUIDs
   ├─ pack_icon.png
   ├─ entity/
   │  ├─ painting_<id1>.entity.json      ← client_entity, spawn_egg.texture
   │  └─ ...
   ├─ models/entity/
   │  ├─ painting_<id1>.geo.json         ← sized per painting
   │  └─ ...
   ├─ render_controllers/
   │  ├─ painting_<id1>.rc.json          ← standard, single geo + texture
   │  └─ ...
   ├─ animation_controllers/
   │  └─ painting_wall_snap.ac.json      ← SHARED
   ├─ animations/
   │  └─ painting_wall_snap.animation.json   ← SHARED
   ├─ textures/
   │  ├─ entity/
   │  │  └─ painting_<id1>.png
   │  ├─ items/
   │  │  └─ painting_<id1>_egg.png
   │  └─ item_texture.json
   └─ texts/
      ├─ en_US.lang
      └─ languages.json
```

### Stable UUIDs

The four manifest UUIDs (BP header, BP module, RP header, RP module) are generated on first build, written into `ProjectState.uuids`, and reused on every subsequent build. End users installing an update get the same pack identity.

### Localization scaffolding for future locales

- `lang.ts` produces a `Map<locale, Record<string, string>>`. Today, `locale ∈ {'en_US'}`. Adding `it_IT` later means extending the map and adding the locale to `languages.json`.
- `Painting` may later grow `displayNameByLocale: Record<string, string>`; for now we keep a single `name` and treat it as en_US.

## 9. Per-painting BP/RP files

### `entities/painting_<id>.behavior.json` (BP)

```json
{
  "format_version": "1.21.0",
  "minecraft:entity": {
    "description": {
      "identifier": "<namespace>:painting_<id>",
      "is_spawnable": true,
      "is_summonable": true,
      "is_experimental": false
    },
    "components": {
      "minecraft:type_family":        { "family": ["<namespace>_painting", "inanimate"] },
      "minecraft:collision_box":      { "width": 0, "height": 0 },
      "minecraft:physics":            { "has_collision": false, "has_gravity": false },
      "minecraft:pushable":           { "is_pushable": false, "is_pushable_by_piston": false },
      "minecraft:knockback_resistance": { "value": 1000, "max": 1000 },
      "minecraft:health":             { "value": 1, "max": 1 },
      "minecraft:damage_sensor": {
        "triggers": [{
          "on_damage": {
            "filters": { "test": "is_family", "subject": "other", "value": "player" }
          },
          "deals_damage": false,
          "event": { "event": "despawn_self", "target": "self" }
        }]
      },
      "minecraft:nameable": { "allow_name_tag_renaming": false }
    },
    "events": {
      "despawn_self": { "add": { "component_groups": ["instant_despawn"] } }
    },
    "component_groups": {
      "instant_despawn": { "minecraft:instant_despawn": {} }
    }
  }
}
```

### `entity/painting_<id>.entity.json` (RP client_entity)

```json
{
  "format_version": "1.10.0",
  "minecraft:client_entity": {
    "description": {
      "identifier": "<namespace>:painting_<id>",
      "materials": { "default": "<entity_alphatest|entity_alphablend, from painting.material>" },
      "textures":  { "default": "textures/entity/painting_<id>" },
      "geometry":  { "default": "geometry.painting_<id>" },
      "render_controllers": [ "controller.render.painting_<id>" ],
      "spawn_egg": {
        "texture": "painting_<id>_egg",
        "texture_index": 0
      },
      "animations": {
        "wall_snap":       "animation.painting_wall_snap",
        "wall_snap_apply": "controller.animation.painting_wall_snap"
      },
      "scripts": { "animate": [ "wall_snap_apply" ] }
    }
  }
}
```

### `models/entity/painting_<id>.geo.json`

```json
{
  "format_version": "1.12.0",
  "minecraft:geometry": [{
    "description": {
      "identifier": "geometry.painting_<id>",
      "texture_width":  <canvasW16>,
      "texture_height": <canvasH16>,
      "visible_bounds_width":  <ceil(max(W,H)/16) + 1>,
      "visible_bounds_height": <ceil(max(W,H)/16) + 1>,
      "visible_bounds_offset": [0, <canvasH16/32>, 0]
    },
    "bones": [{
      "name": "root",
      "pivot": [0, 0, 0],
      "cubes": [{
        "origin": [ -<canvasW16/2>, 0, -7 ],
        "size":   [  <canvasW16>,   <canvasH16>, 0 ],
        "uv": {
          "north": { "uv": [0, 0],            "uv_size": [ <canvasW16>,  <canvasH16> ] },
          "south": { "uv": [0, <canvasH16>],  "uv_size": [ <canvasW16>, -<canvasH16> ] },
          "east":  { "uv": [0, 0],            "uv_size": [ 0,            <canvasH16> ] },
          "west":  { "uv": [0, 0],            "uv_size": [ 0,            <canvasH16> ] },
          "up":    { "uv": [0, 0],            "uv_size": [ <canvasW16>,  0 ] },
          "down":  { "uv": [0, 0],            "uv_size": [ <canvasW16>,  0 ] }
        }
      }]
    }]
  }]
}
```

- `texture_width / texture_height` are in UV space (= 1/16-block units). Bedrock samples the higher-resolution PNG across this UV space automatically.
- `origin.z = -7` places the painting plane near the back of the entity's local box. **The exact sign/value is empirical** and will be confirmed in Minecraft during implementation; if the painting renders backwards or far from the wall, flip the sign or shift z by ±1.
- North = front. South face maps the texture mirrored (back is still readable from behind) — alternatively `uv_size=[0,0]` would make the back invisible. We default to mirrored.
- Side/top/bottom faces have `uv_size` with a zero dimension → not rendered.

### `render_controllers/painting_<id>.rc.json`

```json
{
  "format_version": "1.10.0",
  "render_controllers": {
    "controller.render.painting_<id>": {
      "geometry":  "Geometry.default",
      "materials": [ { "*": "Material.default" } ],
      "textures":  [ "Texture.default" ]
    }
  }
}
```

Per the requirement: standard render controller, no array indirection, no variants — each painting is fully independent.

### `animations/painting_wall_snap.animation.json` (SHARED)

```json
{
  "format_version": "1.8.0",
  "animations": {
    "animation.painting_wall_snap": {
      "loop": true,
      "bones": {
        "root": {
          "rotation": [
            0,
            "math.floor((q.body_y_rotation + 45) / 90) * 90 - q.body_y_rotation",
            0
          ]
        }
      }
    }
  }
}
```

### `animation_controllers/painting_wall_snap.ac.json` (SHARED)

```json
{
  "format_version": "1.10.0",
  "animation_controllers": {
    "controller.animation.painting_wall_snap": {
      "initial_state": "default",
      "states": {
        "default": { "animations": [ "animation.painting_wall_snap" ] }
      }
    }
  }
}
```

The Molang formula computes the delta between the actual `body_y_rotation` and the nearest 90° multiple, then applies that as a bone rotation. The server-side body rotation stays free; only the rendered model snaps to cardinal direction.

### `item_catalog/crafting_item_catalog.json` (BP)

```json
{
  "format_version": "1.21.60",
  "minecraft:crafting_items_catalog": {
    "categories": [{
      "category_name": "equipment",
      "groups": [{
        "group_identifier": {
          "name": "<namespace>:paintings",
          "icon": "<namespace>:painting_<first-id>"
        },
        "items": [
          "<namespace>:painting_<id1>_spawn_egg",
          "<namespace>:painting_<id2>_spawn_egg"
        ]
      }]
    }]
  }
}
```

- `equipment` is one of the four allowed top-level categories. Spawn eggs live here by default.
- `group_identifier.name` must match a key in the BP `en_US.lang` (`itemGroup.name.<namespace>:paintings=...`).
- Group icon = the first painting (re-orderable via the sidebar).

### `textures/item_texture.json` (RP)

```json
{
  "resource_pack_name": "<pack name>",
  "texture_name": "atlas.items",
  "texture_data": {
    "painting_<id1>_egg": { "textures": "textures/items/painting_<id1>_egg" },
    "painting_<id2>_egg": { "textures": "textures/items/painting_<id2>_egg" }
  }
}
```

### `texts/en_US.lang` (BP)

```
itemGroup.name.<namespace>:paintings=<creativeGroupName>
item.<namespace>:painting_<id1>_spawn_egg.name=<painting1.name>
item.<namespace>:painting_<id2>_spawn_egg.name=<painting2.name>
```

### `texts/en_US.lang` (RP)

```
entity.<namespace>:painting_<id1>.name=<painting1.name>
entity.<namespace>:painting_<id2>.name=<painting2.name>
```

### Manifests

`BP_<namespace>/manifest.json`:

```json
{
  "format_version": 2,
  "header": {
    "name":  "pack.name",
    "description": "pack.description",
    "uuid": "<uuids.bpHeader>",
    "version": [<semver>],
    "min_engine_version": [<minEngineVersion>]
  },
  "modules": [
    { "type": "data", "uuid": "<uuids.bpModule>", "version": [<semver>] }
  ],
  "dependencies": [
    { "uuid": "<uuids.rpHeader>", "version": [<semver>] }
  ]
}
```

`RP_<namespace>/manifest.json`: same structure, `module.type = "resources"`, dependency points to BP header.

## 10. Persistence & project portability

### Auto-save (localStorage)

- Svelte store `project.ts` is the single source of truth.
- `persistence.ts` subscribes and writes `JSON.stringify(state)` to key `mc-painting-maker:project`, **debounced 1 s**.
- Boot: if the key exists and `state.version === 1`, load it; otherwise start blank.

### Quota awareness

- localStorage budget is ~5–10 MB. Source PNGs in base64 dominate.
- The UI shows a project-size meter in the pack panel. At >80% of 5 MB, surface a "Export backup" prompt; the build still works.

### Schema migration

- `ProjectState.version` is a literal `1` today.
- If we change the schema in v2, `migrate(state: unknown): ProjectState` will upgrade older states at load time.
- If a future version is read by an older app, prompt the user to export and discard.

### Export/import JSON

- Export → `<pack-name>-project.json` blob download. Single self-contained file (PNGs inline as base64).
- Import → file input → zod-validate → confirm prompt → overwrite store.

## 11. Pack-meta UI

```
Pack Settings
─────────────────────────
Name                [ My Art Collection              ]
Description         [ ...                            ]
Namespace           [ myart                          ]  ← validated
Version             [ 1 ] . [ 0 ] . [ 0 ]
Min engine version  [ 1 ] . [ 21 ] . [ 0 ]
Pack icon           [ Drop PNG... ] [preview]

Creative group name [ Custom Paintings               ]
Project size:  2.4 MB / ~5 MB    [ Export JSON ] [ Import JSON ]
                                                  ──────────────
                                                  [ Build .mcaddon ]
```

### Validation rules

- Namespace: `/^[a-z][a-z0-9_]{0,15}$/`, must not equal `minecraft`.
- Semver: three non-negative integers.
- Min engine version: ≥ [1, 21, 0] (older versions miss `crafting_item_catalog` and other recent format versions).
- Pack icon: optional PNG; if absent, generate a placeholder atlas from the first 1–4 painting thumbnails.

## 12. Error handling

User-visible errors (toast/inline):

- Upload of unsupported format → "Format not supported, use PNG or JPEG."
- Decode failure → "Failed to decode image."
- Invalid namespace on blur → inline error.
- Build clicked with zero paintings → button disabled + tooltip.
- localStorage write fails (quota exceeded) → "Save failed; please export the project and reduce image sizes."

Silent fallbacks (console + still works):

- No `OffscreenCanvas` → fall back to in-DOM `<canvas>`. Slower but functional.
- No File System Access API → fall back to `<a download>` (which we always use anyway).

No telemetry. No analytics. The repo is public and the tool is offline.

## 13. Testing strategy

### Unit (vitest)

- `paintings/schema.ts` — zod round-trip and rejection of malformed input.
- `mcpack/geometry.ts` — given a `Painting`, the produced geo JSON matches snapshot.
- `mcpack/entity.ts` — snapshot per painting.
- `mcpack/client_entity.ts` — snapshot per painting.
- `mcpack/catalog.ts` — snapshot for a multi-painting ProjectState.
- `mcpack/lang.ts` — snapshot.
- `mcpack/manifest.ts` — UUID stability: build twice with same state → same UUIDs.
- `mcpack/build.ts` — integration: build a `Blob`, unzip in-memory, assert the expected file list and that each entry parses as valid JSON.

### Component (Svelte Testing Library)

- `PaintingEditor` renders without crashing given a fixture state, with the grid layer present and the transformer attached.
- Namespace input validation feedback.

### Manual / e2e (documented in README, not automated)

- Build a sample pack with 3 paintings of different sizes (1×1, 2.5×3, 4×1.5).
- Import the `.mcaddon` into Minecraft Bedrock.
- Verify: spawn eggs appear in the custom creative group; spawning on a wall produces a cardinal-aligned painting at the wall surface; punching it despawns it; second build with the same project preserves entity identifiers.

Headless Minecraft testing is intentionally out of scope.

## 14. Open implementation risks (to verify during build-out)

1. **Geometry origin Z sign** (sec. 9). The painting plane must end up flush with the wall after the spawn egg places the entity. The expected value is `z = -7`; testing in Minecraft will confirm.
2. **Spawn-egg body rotation** at spawn-time. If Bedrock makes the egg-spawned entity face the wall by default (rather than the player), the molang formula stays correct (it just snaps whatever rotation it gets to a cardinal). If it faces an unexpected direction, we may add a fixed 180° offset.
3. **`crafting_item_catalog` group icon** — the `icon` field accepts an item identifier; we use `<namespace>:painting_<first-id>` (the spawn-egg-bearing entity). If the rendered icon misbehaves (e.g. shows a generic mob egg), we fall back to using the spawn-egg item identifier `<namespace>:painting_<first-id>_spawn_egg`.
4. **Browser export size** — `fflate` is fast, but a multi-megabyte pack still blocks the main thread briefly during encoding. Acceptable for the first version; the WebWorker fallback is a known follow-up.
5. **Spawn-egg `.lang` key** — the exact localization key Bedrock honors for an auto-generated spawn egg is one of `item.<entity>_spawn_egg.name`, `item.spawn_egg.entity.<entity>.name`, or implicit via the entity name. The implementation plan must include an in-game verification step and pick the working form. As a safe fallback, set the entity's `.name` key in the RP `.lang`; in-game the spawn egg name becomes "Spawn &lt;entity name&gt;".

These are flagged here so the implementation plan can include explicit verification steps for each one.

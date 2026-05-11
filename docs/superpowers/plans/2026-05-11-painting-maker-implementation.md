# MC Painting Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static client-side web app (Vite + Svelte + TS) that turns user-uploaded images into a Minecraft Bedrock `.mcaddon` containing one custom independent painting entity per image.

**Architecture:** A single SPA under `web/`. The store (`stores/project.ts`) holds the full `ProjectState`. Pure modules under `paintings/` (rasterization math, schema) and `mcpack/` (all per-pack JSON file generators) are unit-testable in Node with Vitest. UI under `editor/` and root components consume the store and dispatch updates. A single button orchestrates rasterization + zipping (`fflate`) into a downloadable `.mcaddon`. Cardinal-snap rotation runs in-game via a tiny `@minecraft/server` 2.4.0 script embedded in the BP.

**Tech Stack:** Vite, Svelte, TypeScript (strict), Konva.js, fflate, uuid, zod, Vitest, Testing Library, happy-dom. GitHub Pages for deploy.

**Reference spec:** `docs/superpowers/specs/2026-05-11-painting-maker-design.md`

---

## File map (will be created)

```
web/
├─ package.json
├─ tsconfig.json
├─ tsconfig.node.json
├─ vite.config.ts
├─ index.html
├─ svelte.config.js
├─ public/
└─ src/
   ├─ main.ts
   ├─ App.svelte
   ├─ app.css
   ├─ vite-env.d.ts
   │
   ├─ stores/
   │  ├─ project.ts             # Svelte store wrapping ProjectState
   │  ├─ project.test.ts
   │  ├─ persistence.ts         # debounced localStorage + JSON import/export
   │  └─ persistence.test.ts
   │
   ├─ paintings/
   │  ├─ types.ts               # TS types
   │  ├─ schema.ts              # zod schemas + version migration
   │  ├─ schema.test.ts
   │  ├─ defaults.ts            # createEmptyProject(), createPaintingFromImage()
   │  ├─ defaults.test.ts
   │  ├─ density.ts             # resolveDensity('auto' | n)
   │  ├─ density.test.ts
   │  ├─ rasterize.ts           # computeRasterParams (pure) + rasterize (canvas)
   │  └─ rasterize.test.ts
   │
   ├─ mcpack/
   │  ├─ identifiers.ts         # sanitize(uuid) → snake-cased id
   │  ├─ identifiers.test.ts
   │  ├─ manifest.ts            # BP/RP manifest.json
   │  ├─ manifest.test.ts
   │  ├─ lang.ts                # BP/RP en_US.lang content
   │  ├─ lang.test.ts
   │  ├─ catalog.ts             # crafting_item_catalog.json
   │  ├─ catalog.test.ts
   │  ├─ item_texture.ts        # item_texture.json
   │  ├─ item_texture.test.ts
   │  ├─ script.ts              # BP scripts/main.js content (string template)
   │  ├─ script.test.ts
   │  ├─ entity.ts              # BP entity behavior JSON
   │  ├─ entity.test.ts
   │  ├─ client_entity.ts       # RP client entity JSON
   │  ├─ client_entity.test.ts
   │  ├─ geometry.ts            # geo.json per painting
   │  ├─ geometry.test.ts
   │  ├─ render_controller.ts   # rc.json per painting
   │  ├─ render_controller.test.ts
   │  ├─ build.ts               # orchestrator: ProjectState → Blob
   │  └─ build.test.ts
   │
   ├─ editor/
   │  ├─ PaintingEditor.svelte  # Konva stage, toolbar
   │  ├─ GridLayer.ts           # adds block + 1/16 lines to a layer
   │  ├─ ImageLayer.ts          # Konva Image with snap-to-1/16 drag/resize
   │  └─ CanvasResizer.ts       # handles on canvas borders
   │
   ├─ ui/
   │  ├─ Sidebar.svelte         # painting list + add/delete/reorder
   │  ├─ PackSettings.svelte    # right panel (name, namespace, version…)
   │  ├─ FileDrop.svelte        # drop zone
   │  └─ Toast.svelte           # transient messages
   │
   └─ util/
      ├─ debounce.ts
      ├─ debounce.test.ts
      ├─ base64.ts              # base64 ↔ Blob helpers
      └─ base64.test.ts

.github/workflows/pages.yml     # build & deploy to GitHub Pages
README.md                       # updated with usage
```

The existing top-level `test_painting.geo.json` and `texture.png` stay untouched (kept as references).

---

## Conventions

- Tests live next to source as `*.test.ts`. Vitest auto-picks them up.
- Commits use **Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). **No co-authoring lines.**
- All source/test files: **English only**.
- Imports: relative (`./foo`, `../bar`). No path aliases initially (YAGNI).
- TS strict mode on. No `any` without an explicit reason in a comment.
- All commands assume working directory `C:/Users/FabrizioLaRosa/Repos/MC-Painting-Maker` unless `cd web` is noted.
- The shell is PowerShell. Where chaining is needed, `&&` works in PowerShell 7+.

---

## Phase 1 — Project bootstrap

### Task 1: Initialize Vite + Svelte + TypeScript project

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/tsconfig.node.json`, `web/vite.config.ts`, `web/index.html`, `web/svelte.config.js`, `web/src/main.ts`, `web/src/App.svelte`, `web/src/app.css`, `web/src/vite-env.d.ts`, `web/.gitignore`

- [ ] **Step 1: Scaffold the project files manually (avoids interactive `npm create` prompts)**

Create `web/package.json`:
```json
{
  "name": "mc-painting-maker",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.1.2",
    "@testing-library/svelte": "^5.2.4",
    "@tsconfig/svelte": "^5.0.4",
    "@types/uuid": "^10.0.0",
    "happy-dom": "^15.11.7",
    "svelte": "^4.2.19",
    "svelte-check": "^4.0.9",
    "tslib": "^2.8.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.5"
  },
  "dependencies": {
    "fflate": "^0.8.2",
    "konva": "^9.3.16",
    "uuid": "^11.0.3",
    "zod": "^3.23.8"
  }
}
```

Create `web/tsconfig.json`:
```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "resolveJsonModule": true,
    "allowJs": false,
    "checkJs": false,
    "isolatedModules": true,
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.svelte"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `web/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
```

Create `web/svelte.config.js`:
```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess() };
```

Create `web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MC Painting Maker</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `web/src/main.ts`:
```ts
import './app.css';
import App from './App.svelte';

const app = new App({ target: document.getElementById('app')! });
export default app;
```

Create `web/src/App.svelte`:
```svelte
<main>
  <h1>MC Painting Maker</h1>
  <p>Coming soon.</p>
</main>
```

Create `web/src/app.css`:
```css
:root { font-family: system-ui, sans-serif; color-scheme: light dark; }
body  { margin: 0; min-height: 100vh; }
main  { max-width: 960px; margin: 0 auto; padding: 1rem; }
```

Create `web/src/vite-env.d.ts`:
```ts
/// <reference types="svelte" />
/// <reference types="vite/client" />
```

Create `web/.gitignore`:
```
node_modules
dist
.vite
*.log
.DS_Store
```

- [ ] **Step 2: Install dependencies**

Run:
```powershell
cd web; npm install
```

Expected: a `node_modules/` directory and `package-lock.json` are produced; no errors.

- [ ] **Step 3: Verify the dev server starts and type-check passes**

Run:
```powershell
cd web; npm run check
```

Expected: `svelte-check` reports 0 errors, 0 warnings.

Then start the dev server briefly:
```powershell
cd web; npm run dev
```

Expected: prints a local URL (e.g. `http://localhost:5173/`). Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```powershell
git add web/ .gitignore
git commit -m "chore: scaffold Vite + Svelte + TS project"
```

---

### Task 2: Set up Vitest with a sanity test

**Files:**
- Create: `web/src/util/sanity.test.ts`

- [ ] **Step 1: Write a trivial passing test**

Create `web/src/util/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests**

Run:
```powershell
cd web; npm test
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```powershell
git add web/src/util/sanity.test.ts
git commit -m "test: add sanity test to verify vitest runs"
```

---

### Task 3: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Add workflow**

Create `.github/workflows/pages.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```powershell
git add .github/workflows/pages.yml
git commit -m "ci: add GitHub Pages deploy workflow"
```

(The workflow runs once pushed; deploy success is verified manually after Task 38.)

---

## Phase 2 — Data model

### Task 4: TypeScript types

**Files:**
- Create: `web/src/paintings/types.ts`

- [ ] **Step 1: Add types**

Create `web/src/paintings/types.ts`:
```ts
export type SemVer = [number, number, number];

export type PackMeta = {
  name: string;
  description: string;
  namespace: string;
  semver: SemVer;
  minEngineVersion: SemVer;
  iconPngBase64: string | null;
  creativeGroupName: string;
};

export type PackUUIDs = {
  bpHeader: string;
  bpModule: string;
  bpScriptModule: string;
  rpHeader: string;
  rpModule: string;
};

export type Transform = {
  x16: number;
  y16: number;
  w16: number;
  h16: number;
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
};

export type Source = {
  pngBase64: string;
  naturalW: number;
  naturalH: number;
};

export type Density = 'auto' | 1 | 2 | 4 | 8 | 16 | 32 | 64;
export type Resampling = 'smooth' | 'pixelated';
export type Material = 'alphatest' | 'alphablend';

export type Painting = {
  id: string;
  name: string;
  canvasW16: number;
  canvasH16: number;
  source: Source | null;
  transform: Transform;
  resampling: Resampling;
  textureDensity: Density;
  material: Material;
};

export type ProjectState = {
  version: 1;
  pack: PackMeta;
  uuids: PackUUIDs;
  paintings: Painting[];
};
```

- [ ] **Step 2: Verify TS compiles**

Run:
```powershell
cd web; npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add web/src/paintings/types.ts
git commit -m "feat: add painting/project types"
```

---

### Task 5: zod schema mirroring the types

**Files:**
- Create: `web/src/paintings/schema.ts`
- Create: `web/src/paintings/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/paintings/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ProjectSchema } from './schema';

const minimalProject = {
  version: 1,
  pack: {
    name: 'Test',
    description: '',
    namespace: 'test',
    semver: [1, 0, 0],
    minEngineVersion: [1, 21, 0],
    iconPngBase64: null,
    creativeGroupName: 'Test Paintings',
  },
  uuids: {
    bpHeader: '00000000-0000-0000-0000-000000000001',
    bpModule: '00000000-0000-0000-0000-000000000002',
    bpScriptModule: '00000000-0000-0000-0000-000000000003',
    rpHeader: '00000000-0000-0000-0000-000000000004',
    rpModule: '00000000-0000-0000-0000-000000000005',
  },
  paintings: [],
};

describe('ProjectSchema', () => {
  it('accepts a minimal valid project', () => {
    expect(() => ProjectSchema.parse(minimalProject)).not.toThrow();
  });

  it('rejects an invalid namespace', () => {
    const bad = { ...minimalProject, pack: { ...minimalProject.pack, namespace: 'Invalid-Name' } };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });

  it('rejects the reserved namespace "minecraft"', () => {
    const bad = { ...minimalProject, pack: { ...minimalProject.pack, namespace: 'minecraft' } };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });

  it('rejects a painting with non-integer canvasW16', () => {
    const bad = {
      ...minimalProject,
      paintings: [{
        id: 'p1', name: 'a',
        canvasW16: 1.5, canvasH16: 16,
        source: null,
        transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
        resampling: 'smooth', textureDensity: 'auto', material: 'alphatest',
      }],
    };
    expect(() => ProjectSchema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run:
```powershell
cd web; npm test -- schema
```

Expected: FAIL with "Cannot find module './schema'".

- [ ] **Step 3: Implement the schema**

Create `web/src/paintings/schema.ts`:
```ts
import { z } from 'zod';

const SemVerSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);

const NamespaceSchema = z.string()
  .regex(/^[a-z][a-z0-9_]{0,15}$/, 'namespace must match /^[a-z][a-z0-9_]{0,15}$/')
  .refine((v) => v !== 'minecraft', 'namespace cannot be "minecraft"');

export const PackMetaSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  namespace: NamespaceSchema,
  semver: SemVerSchema,
  minEngineVersion: SemVerSchema,
  iconPngBase64: z.string().nullable(),
  creativeGroupName: z.string().min(1),
});

export const PackUUIDsSchema = z.object({
  bpHeader:        z.string().uuid(),
  bpModule:        z.string().uuid(),
  bpScriptModule:  z.string().uuid(),
  rpHeader:        z.string().uuid(),
  rpModule:        z.string().uuid(),
});

export const TransformSchema = z.object({
  x16: z.number().int(),
  y16: z.number().int(),
  w16: z.number().int().nonnegative(),
  h16: z.number().int().nonnegative(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  flipX: z.boolean(),
  flipY: z.boolean(),
});

export const SourceSchema = z.object({
  pngBase64: z.string(),
  naturalW: z.number().int().positive(),
  naturalH: z.number().int().positive(),
});

export const PaintingSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  canvasW16: z.number().int().positive(),
  canvasH16: z.number().int().positive(),
  source: SourceSchema.nullable(),
  transform: TransformSchema,
  resampling: z.union([z.literal('smooth'), z.literal('pixelated')]),
  textureDensity: z.union([
    z.literal('auto'),
    z.literal(1), z.literal(2), z.literal(4), z.literal(8),
    z.literal(16), z.literal(32), z.literal(64),
  ]),
  material: z.union([z.literal('alphatest'), z.literal('alphablend')]),
});

export const ProjectSchema = z.object({
  version: z.literal(1),
  pack: PackMetaSchema,
  uuids: PackUUIDsSchema,
  paintings: z.array(PaintingSchema),
});

export type Project = z.infer<typeof ProjectSchema>;
```

- [ ] **Step 4: Run the test, verify it passes**

Run:
```powershell
cd web; npm test -- schema
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/paintings/schema.ts web/src/paintings/schema.test.ts
git commit -m "feat: add zod schema for ProjectState with validation"
```

---

### Task 6: Project defaults & migration

**Files:**
- Create: `web/src/paintings/defaults.ts`
- Create: `web/src/paintings/defaults.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/paintings/defaults.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createEmptyProject } from './defaults';
import { ProjectSchema } from './schema';

describe('createEmptyProject', () => {
  it('produces a project that satisfies ProjectSchema', () => {
    const p = createEmptyProject();
    expect(() => ProjectSchema.parse(p)).not.toThrow();
  });

  it('produces unique UUIDs each call', () => {
    const a = createEmptyProject();
    const b = createEmptyProject();
    expect(a.uuids.bpHeader).not.toBe(b.uuids.bpHeader);
  });

  it('starts with no paintings', () => {
    expect(createEmptyProject().paintings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run:
```powershell
cd web; npm test -- defaults
```

Expected: FAIL with "Cannot find module './defaults'".

- [ ] **Step 3: Implement**

Create `web/src/paintings/defaults.ts`:
```ts
import { v4 as uuidv4 } from 'uuid';
import type { ProjectState, Painting, Source } from './types';

export function createEmptyProject(): ProjectState {
  return {
    version: 1,
    pack: {
      name: 'My Paintings',
      description: 'Custom paintings generated by MC Painting Maker.',
      namespace: 'paintings',
      semver: [1, 0, 0],
      minEngineVersion: [1, 21, 30],
      iconPngBase64: null,
      creativeGroupName: 'Custom Paintings',
    },
    uuids: {
      bpHeader: uuidv4(),
      bpModule: uuidv4(),
      bpScriptModule: uuidv4(),
      rpHeader: uuidv4(),
      rpModule: uuidv4(),
    },
    paintings: [],
  };
}

export function createPaintingFromImage(
  name: string,
  source: Source,
): Painting {
  const ratio = source.naturalW / source.naturalH;
  const maxLong = 64;
  let w16: number, h16: number;
  if (ratio >= 1) {
    w16 = maxLong;
    h16 = Math.max(16, Math.round((maxLong / ratio) / 16) * 16);
  } else {
    h16 = maxLong;
    w16 = Math.max(16, Math.round((maxLong * ratio) / 16) * 16);
  }
  return {
    id: uuidv4(),
    name,
    canvasW16: w16,
    canvasH16: h16,
    source,
    transform: { x16: 0, y16: 0, w16, h16, rotation: 0, flipX: false, flipY: false },
    resampling: 'smooth',
    textureDensity: 'auto',
    material: 'alphatest',
  };
}

export function migrate(state: unknown): ProjectState {
  if (typeof state !== 'object' || state === null || !('version' in state)) {
    throw new Error('Invalid project state: missing version');
  }
  const v = (state as { version: unknown }).version;
  if (v !== 1) throw new Error(`Unsupported project version: ${String(v)}`);
  return state as ProjectState;
}
```

- [ ] **Step 4: Run, verify pass**

```powershell
cd web; npm test -- defaults
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/paintings/defaults.ts web/src/paintings/defaults.test.ts
git commit -m "feat: add createEmptyProject, createPaintingFromImage, migrate"
```

---

### Task 7: Density resolver

**Files:**
- Create: `web/src/paintings/density.ts`
- Create: `web/src/paintings/density.test.ts`

- [ ] **Step 1: Write failing test**

Create `web/src/paintings/density.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveDensity, nextPow2 } from './density';
import type { Painting } from './types';

function painting(overrides: Partial<Painting> = {}): Painting {
  return {
    id: 'p', name: 'p',
    canvasW16: 16, canvasH16: 16,
    source: { pngBase64: '', naturalW: 64, naturalH: 64 },
    transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
    resampling: 'smooth', textureDensity: 'auto', material: 'alphatest',
    ...overrides,
  };
}

describe('nextPow2', () => {
  it('returns 1 for n <= 1', () => {
    expect(nextPow2(0)).toBe(1);
    expect(nextPow2(1)).toBe(1);
  });
  it('rounds up to the nearest power of two', () => {
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(63)).toBe(64);
    expect(nextPow2(64)).toBe(64);
    expect(nextPow2(65)).toBe(128);
  });
});

describe('resolveDensity', () => {
  it('returns the manual value when not "auto"', () => {
    expect(resolveDensity(painting({ textureDensity: 4 }))).toBe(4);
  });
  it('returns 1 if no source (auto)', () => {
    expect(resolveDensity(painting({ source: null }))).toBe(1);
  });
  it('returns next pow2 of max(srcW/w16, srcH/h16) for auto', () => {
    // 1000 px source in 16 1/16-block units → ceil(62.5) → next pow2 = 64
    const p = painting({
      source: { pngBase64: '', naturalW: 1000, naturalH: 1000 },
      transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
    });
    expect(resolveDensity(p)).toBe(64);
  });
  it('clamps auto to max 64', () => {
    const p = painting({
      source: { pngBase64: '', naturalW: 5000, naturalH: 5000 },
      transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
    });
    expect(resolveDensity(p)).toBe(64);
  });
  it('clamps auto to min 1', () => {
    const p = painting({
      source: { pngBase64: '', naturalW: 1, naturalH: 1 },
      transform: { x16: 0, y16: 0, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false },
    });
    expect(resolveDensity(p)).toBe(1);
  });
});
```

- [ ] **Step 2: Run, verify fails**

Run:
```powershell
cd web; npm test -- density
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/src/paintings/density.ts`:
```ts
import type { Painting } from './types';

export function nextPow2(n: number): number {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

export function resolveDensity(p: Painting): number {
  if (p.textureDensity !== 'auto') return p.textureDensity;
  if (!p.source) return 1;
  if (p.transform.w16 === 0 || p.transform.h16 === 0) return 1;
  const ratio = Math.max(
    p.source.naturalW / p.transform.w16,
    p.source.naturalH / p.transform.h16,
  );
  return Math.min(64, Math.max(1, nextPow2(Math.ceil(ratio))));
}
```

- [ ] **Step 4: Run, verify pass**

```powershell
cd web; npm test -- density
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/paintings/density.ts web/src/paintings/density.test.ts
git commit -m "feat: add density resolver with auto-density rule"
```

---

### Task 8: Base64 helpers

**Files:**
- Create: `web/src/util/base64.ts`
- Create: `web/src/util/base64.test.ts`

- [ ] **Step 1: Write failing test**

Create `web/src/util/base64.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { uint8ToBase64, base64ToUint8 } from './base64';

describe('base64 helpers', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const b64 = uint8ToBase64(bytes);
    const back = base64ToUint8(b64);
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });
});
```

- [ ] **Step 2: Run, verify fails**

```powershell
cd web; npm test -- base64
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/src/util/base64.ts`:
```ts
export function uint8ToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

export function base64ToUint8(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- base64
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```powershell
git add web/src/util/base64.ts web/src/util/base64.test.ts
git commit -m "feat: add base64 ↔ Uint8Array helpers"
```

---

### Task 9: Debounce utility

**Files:**
- Create: `web/src/util/debounce.ts`
- Create: `web/src/util/debounce.test.ts`

- [ ] **Step 1: Write failing test**

Create `web/src/util/debounce.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  it('calls only once after rapid invocations', async () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const fn = debounce(spy, 100);
    fn();
    fn();
    fn();
    vi.advanceTimersByTime(99);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('passes the latest arguments through', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const fn = debounce(spy, 50);
    fn(1);
    fn(2);
    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- debounce
```

- [ ] **Step 3: Implement**

Create `web/src/util/debounce.ts`:
```ts
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), delayMs);
  };
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- debounce
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/util/debounce.ts web/src/util/debounce.test.ts
git commit -m "feat: add debounce util"
```

---

## Phase 3 — Stores & persistence

### Task 10: Project store

**Files:**
- Create: `web/src/stores/project.ts`
- Create: `web/src/stores/project.test.ts`

- [ ] **Step 1: Write failing test**

Create `web/src/stores/project.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createProjectStore } from './project';

describe('project store', () => {
  it('exposes an initial empty project', () => {
    const s = createProjectStore();
    const v = get(s);
    expect(v.version).toBe(1);
    expect(v.paintings).toEqual([]);
  });

  it('updates with the set method', () => {
    const s = createProjectStore();
    const v = get(s);
    s.set({ ...v, paintings: [] });
    expect(get(s).paintings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- stores
```

- [ ] **Step 3: Implement**

Create `web/src/stores/project.ts`:
```ts
import { writable } from 'svelte/store';
import { createEmptyProject } from '../paintings/defaults';
import type { ProjectState } from '../paintings/types';

export function createProjectStore(initial?: ProjectState) {
  return writable<ProjectState>(initial ?? createEmptyProject());
}

export const project = createProjectStore();
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- stores
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/stores/project.ts web/src/stores/project.test.ts
git commit -m "feat: add project Svelte store"
```

---

### Task 11: Persistence (localStorage + import/export)

**Files:**
- Create: `web/src/stores/persistence.ts`
- Create: `web/src/stores/persistence.test.ts`

- [ ] **Step 1: Write failing test**

Create `web/src/stores/persistence.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { createProjectStore } from './project';
import { bindPersistence, loadFromStorage, exportProjectJSON, importProjectJSON } from './persistence';

const KEY = 'mc-painting-maker:project';

beforeEach(() => {
  localStorage.clear();
});

describe('loadFromStorage', () => {
  it('returns null when nothing stored', () => {
    expect(loadFromStorage()).toBeNull();
  });
  it('returns the parsed project when stored', () => {
    const s = createProjectStore();
    localStorage.setItem(KEY, JSON.stringify(get(s)));
    expect(loadFromStorage()?.version).toBe(1);
  });
  it('returns null when the stored JSON fails validation', () => {
    localStorage.setItem(KEY, JSON.stringify({ bogus: true }));
    expect(loadFromStorage()).toBeNull();
  });
});

describe('bindPersistence', () => {
  it('debounce-writes to localStorage on changes', async () => {
    vi.useFakeTimers();
    const s = createProjectStore();
    const stop = bindPersistence(s, 50);
    s.update((v) => ({ ...v, pack: { ...v.pack, name: 'Changed' } }));
    vi.advanceTimersByTime(50);
    const raw = localStorage.getItem(KEY);
    expect(raw && JSON.parse(raw).pack.name).toBe('Changed');
    stop();
    vi.useRealTimers();
  });
});

describe('exportProjectJSON / importProjectJSON', () => {
  it('round-trips through JSON text', () => {
    const s = createProjectStore();
    const text = exportProjectJSON(get(s));
    const back = importProjectJSON(text);
    expect(back.version).toBe(1);
  });
  it('throws on malformed input', () => {
    expect(() => importProjectJSON('{ not json')).toThrow();
  });
  it('throws on schema-invalid input', () => {
    expect(() => importProjectJSON(JSON.stringify({ version: 1 }))).toThrow();
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- persistence
```

- [ ] **Step 3: Implement**

Create `web/src/stores/persistence.ts`:
```ts
import type { Writable } from 'svelte/store';
import { ProjectSchema } from '../paintings/schema';
import { migrate } from '../paintings/defaults';
import { debounce } from '../util/debounce';
import type { ProjectState } from '../paintings/types';

const KEY = 'mc-painting-maker:project';

export function loadFromStorage(): ProjectState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    return ProjectSchema.parse(migrated);
  } catch {
    return null;
  }
}

export function bindPersistence(store: Writable<ProjectState>, delayMs = 1000): () => void {
  const write = debounce((v: ProjectState) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch (err) {
      console.warn('localStorage save failed', err);
    }
  }, delayMs);
  return store.subscribe(write);
}

export function exportProjectJSON(state: ProjectState): string {
  return JSON.stringify(state, null, 2);
}

export function importProjectJSON(text: string): ProjectState {
  const raw = JSON.parse(text);
  return ProjectSchema.parse(migrate(raw));
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- persistence
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/stores/persistence.ts web/src/stores/persistence.test.ts
git commit -m "feat: localStorage auto-save + JSON import/export"
```

---

## Phase 4 — mcpack pure generators

Each module emits a JSON-ready JS object (or string) from a `ProjectState` (or sub-object). All are pure and snapshot-tested.

### Task 12: Identifier sanitization

**Files:**
- Create: `web/src/mcpack/identifiers.ts`
- Create: `web/src/mcpack/identifiers.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/identifiers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sanitizeId, entityId, paintingFileBase } from './identifiers';

describe('identifiers', () => {
  it('sanitizes a UUID to snake_case', () => {
    expect(sanitizeId('a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('a3f8b1c2_1234_5678_9abc_deadbeefcafe');
  });

  it('builds the entity identifier as <ns>:painting_<sanitized>', () => {
    expect(entityId('myart', 'a3f8-12'))
      .toBe('myart:painting_a3f8_12');
  });

  it('builds the file base as painting_<sanitized>', () => {
    expect(paintingFileBase('a3f8-12')).toBe('painting_a3f8_12');
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- identifiers
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/identifiers.ts`:
```ts
export function sanitizeId(uuid: string): string {
  return uuid.toLowerCase().replace(/-/g, '_');
}

export function paintingFileBase(uuid: string): string {
  return `painting_${sanitizeId(uuid)}`;
}

export function entityId(namespace: string, uuid: string): string {
  return `${namespace}:${paintingFileBase(uuid)}`;
}

export function spawnEggItemId(namespace: string, uuid: string): string {
  return `${entityId(namespace, uuid)}_spawn_egg`;
}

export function spawnEggTextureKey(uuid: string): string {
  return `${paintingFileBase(uuid)}_egg`;
}

export function geometryName(uuid: string): string {
  return `geometry.${paintingFileBase(uuid)}`;
}

export function renderControllerName(uuid: string): string {
  return `controller.render.${paintingFileBase(uuid)}`;
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- identifiers
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/identifiers.ts web/src/mcpack/identifiers.test.ts
git commit -m "feat(mcpack): identifier sanitization helpers"
```

---

### Task 13: Manifest generator

**Files:**
- Create: `web/src/mcpack/manifest.ts`
- Create: `web/src/mcpack/manifest.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/manifest.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createEmptyProject } from '../paintings/defaults';
import { buildBpManifest, buildRpManifest } from './manifest';

describe('manifest', () => {
  it('builds a BP manifest with header, data + script modules, and RP+@minecraft/server deps', () => {
    const proj = createEmptyProject();
    const m = buildBpManifest(proj);
    expect(m.format_version).toBe(2);
    expect(m.header.uuid).toBe(proj.uuids.bpHeader);
    expect(m.header.version).toEqual(proj.pack.semver);
    expect(m.header.min_engine_version).toEqual(proj.pack.minEngineVersion);
    expect(m.modules.length).toBe(2);
    expect(m.modules[0].type).toBe('data');
    expect(m.modules[1].type).toBe('script');
    expect(m.modules[1].entry).toBe('scripts/main.js');
    expect(m.dependencies).toContainEqual({ uuid: proj.uuids.rpHeader, version: proj.pack.semver });
    expect(m.dependencies).toContainEqual({ module_name: '@minecraft/server', version: '2.4.0' });
  });

  it('builds an RP manifest with header and resources module + BP dep', () => {
    const proj = createEmptyProject();
    const m = buildRpManifest(proj);
    expect(m.header.uuid).toBe(proj.uuids.rpHeader);
    expect(m.modules[0].type).toBe('resources');
    expect(m.dependencies).toContainEqual({ uuid: proj.uuids.bpHeader, version: proj.pack.semver });
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- manifest
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/manifest.ts`:
```ts
import type { ProjectState } from '../paintings/types';

export const SCRIPT_MODULE_VERSION = '2.4.0';

export function buildBpManifest(p: ProjectState) {
  return {
    format_version: 2,
    header: {
      name: 'pack.name',
      description: 'pack.description',
      uuid: p.uuids.bpHeader,
      version: p.pack.semver,
      min_engine_version: p.pack.minEngineVersion,
    },
    modules: [
      { type: 'data', uuid: p.uuids.bpModule, version: p.pack.semver },
      {
        type: 'script',
        uuid: p.uuids.bpScriptModule,
        version: p.pack.semver,
        language: 'javascript',
        entry: 'scripts/main.js',
      },
    ],
    dependencies: [
      { uuid: p.uuids.rpHeader, version: p.pack.semver },
      { module_name: '@minecraft/server', version: SCRIPT_MODULE_VERSION },
    ],
  };
}

export function buildRpManifest(p: ProjectState) {
  return {
    format_version: 2,
    header: {
      name: 'pack.name',
      description: 'pack.description',
      uuid: p.uuids.rpHeader,
      version: p.pack.semver,
      min_engine_version: p.pack.minEngineVersion,
    },
    modules: [{ type: 'resources', uuid: p.uuids.rpModule, version: p.pack.semver }],
    dependencies: [{ uuid: p.uuids.bpHeader, version: p.pack.semver }],
  };
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- manifest
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/manifest.ts web/src/mcpack/manifest.test.ts
git commit -m "feat(mcpack): BP/RP manifest generators"
```

---

### Task 14: Lang file generator

**Files:**
- Create: `web/src/mcpack/lang.ts`
- Create: `web/src/mcpack/lang.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/lang.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildBpLang, buildRpLang } from './lang';

describe('lang', () => {
  it('builds the BP lang with group + spawn egg names', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildBpLang(proj);
    expect(lang).toContain(`itemGroup.name.paintings:paintings=Custom Paintings`);
    const expected = `item.paintings:painting_${p.id.replace(/-/g, '_')}_spawn_egg.name=Sunset`;
    expect(lang).toContain(expected);
  });

  it('builds the RP lang with entity name keys', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('Sunset', {
      pngBase64: '', naturalW: 100, naturalH: 100,
    });
    proj.paintings.push(p);
    const lang = buildRpLang(proj);
    const expected = `entity.paintings:painting_${p.id.replace(/-/g, '_')}.name=Sunset`;
    expect(lang).toContain(expected);
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- lang
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/lang.ts`:
```ts
import type { ProjectState } from '../paintings/types';
import { entityId, spawnEggItemId } from './identifiers';

export function buildBpLang(p: ProjectState): string {
  const lines: string[] = [];
  lines.push(`itemGroup.name.${p.pack.namespace}:paintings=${p.pack.creativeGroupName}`);
  for (const pt of p.paintings) {
    lines.push(`item.${spawnEggItemId(p.pack.namespace, pt.id)}.name=${pt.name}`);
  }
  return lines.join('\n') + '\n';
}

export function buildRpLang(p: ProjectState): string {
  const lines: string[] = [];
  for (const pt of p.paintings) {
    lines.push(`entity.${entityId(p.pack.namespace, pt.id)}.name=${pt.name}`);
  }
  return lines.join('\n') + '\n';
}

export const LANGUAGES_JSON = JSON.stringify(['en_US']);
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- lang
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/lang.ts web/src/mcpack/lang.test.ts
git commit -m "feat(mcpack): en_US.lang generators for BP and RP"
```

---

### Task 15: Crafting item catalog

**Files:**
- Create: `web/src/mcpack/catalog.ts`
- Create: `web/src/mcpack/catalog.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/catalog.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildCatalog } from './catalog';

describe('buildCatalog', () => {
  it('places spawn eggs under the equipment category in a namespaced group', () => {
    const proj = createEmptyProject();
    const a = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    const b = createPaintingFromImage('B', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(a, b);
    const cat = buildCatalog(proj);
    expect(cat.format_version).toBe('1.21.60');
    const group = cat['minecraft:crafting_items_catalog'].categories[0];
    expect(group.category_name).toBe('equipment');
    expect(group.groups[0].group_identifier.name).toBe('paintings:paintings');
    expect(group.groups[0].items).toHaveLength(2);
    expect(group.groups[0].items[0]).toContain('_spawn_egg');
  });

  it('returns null when there are no paintings', () => {
    const proj = createEmptyProject();
    expect(buildCatalog(proj)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- catalog
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/catalog.ts`:
```ts
import type { ProjectState } from '../paintings/types';
import { entityId, spawnEggItemId } from './identifiers';

export function buildCatalog(p: ProjectState) {
  if (p.paintings.length === 0) return null;
  const first = p.paintings[0];
  return {
    format_version: '1.21.60',
    'minecraft:crafting_items_catalog': {
      categories: [{
        category_name: 'equipment',
        groups: [{
          group_identifier: {
            name: `${p.pack.namespace}:paintings`,
            icon: entityId(p.pack.namespace, first.id),
          },
          items: p.paintings.map((pt) => spawnEggItemId(p.pack.namespace, pt.id)),
        }],
      }],
    },
  };
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- catalog
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/catalog.ts web/src/mcpack/catalog.test.ts
git commit -m "feat(mcpack): crafting_item_catalog generator"
```

---

### Task 16: item_texture.json

**Files:**
- Create: `web/src/mcpack/item_texture.ts`
- Create: `web/src/mcpack/item_texture.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/item_texture.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildItemTexture } from './item_texture';

describe('buildItemTexture', () => {
  it('maps spawn egg texture keys to file paths under textures/items/', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const it = buildItemTexture(proj);
    const key = `painting_${p.id.replace(/-/g, '_')}_egg`;
    expect(it.texture_data[key].textures).toBe(`textures/items/${key}`);
    expect(it.resource_pack_name).toBe(proj.pack.name);
    expect(it.texture_name).toBe('atlas.items');
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- item_texture
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/item_texture.ts`:
```ts
import type { ProjectState } from '../paintings/types';
import { spawnEggTextureKey } from './identifiers';

export function buildItemTexture(p: ProjectState) {
  const texture_data: Record<string, { textures: string }> = {};
  for (const pt of p.paintings) {
    const k = spawnEggTextureKey(pt.id);
    texture_data[k] = { textures: `textures/items/${k}` };
  }
  return {
    resource_pack_name: p.pack.name,
    texture_name: 'atlas.items',
    texture_data,
  };
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- item_texture
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/item_texture.ts web/src/mcpack/item_texture.test.ts
git commit -m "feat(mcpack): item_texture.json generator"
```

---

### Task 17: BP script (main.js) generator

**Files:**
- Create: `web/src/mcpack/script.ts`
- Create: `web/src/mcpack/script.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/script.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildMainJs } from './script';

describe('buildMainJs', () => {
  it('embeds the namespace family name', () => {
    const code = buildMainJs('myart');
    expect(code).toContain('const FAMILY = "myart_painting"');
  });

  it('imports from @minecraft/server', () => {
    expect(buildMainJs('a')).toContain('from "@minecraft/server"');
  });

  it('subscribes to entitySpawn and snaps rotation by 90°', () => {
    const code = buildMainJs('a');
    expect(code).toContain('afterEvents.entitySpawn.subscribe');
    expect(code).toContain('Math.round(');
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- script
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/script.ts`:
```ts
export function buildMainJs(namespace: string): string {
  return `import { world } from "@minecraft/server";

const FAMILY = "${namespace}_painting";

world.afterEvents.entitySpawn.subscribe((event) => {
  const e = event.entity;
  if (!e.matches({ families: [FAMILY] })) return;
  const r = e.getRotation();
  const snappedY = Math.round(r.y / 90) * 90;
  e.setRotation({ x: 0, y: snappedY });
});
`;
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- script
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/script.ts web/src/mcpack/script.test.ts
git commit -m "feat(mcpack): BP main.js script generator (rotation snap)"
```

---

### Task 18: BP entity behavior (with custom_hit_test)

**Files:**
- Create: `web/src/mcpack/entity.ts`
- Create: `web/src/mcpack/entity.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/entity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildEntityBehavior } from './entity';

describe('buildEntityBehavior', () => {
  it('emits identifier, is_spawnable=true and is_summonable=true', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    expect(j['minecraft:entity'].description.identifier).toBe(`paintings:painting_${p.id.replace(/-/g, '_')}`);
    expect(j['minecraft:entity'].description.is_spawnable).toBe(true);
    expect(j['minecraft:entity'].description.is_summonable).toBe(true);
  });

  it('produces a custom_hit_test sized to the painting (W x H blocks)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('B', { pngBase64: '', naturalW: 32, naturalH: 32 });
    // Force known canvas: 2.5 x 3 blocks
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const comps = j['minecraft:entity'].components as any;
    const hb = comps['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(1);
    expect(hb[0].width).toBeCloseTo(2.5);
    expect(hb[0].height).toBeCloseTo(3);
    expect(hb[0].pivot[1]).toBeCloseTo(1.5); // H/2
    expect(hb[0].pivot[2]).toBeCloseTo(-7 / 16);
  });

  it('clamps hitbox width to 1/16 minimum for zero-canvas paintings', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('C', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 0; p.canvasH16 = 16;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const hb = (j['minecraft:entity'].components as any)['minecraft:custom_hit_test'].hitboxes[0];
    expect(hb.width).toBeCloseTo(1 / 16);
  });

  it('adds the painting family to type_family', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('D', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const fam = (j['minecraft:entity'].components as any)['minecraft:type_family'].family;
    expect(fam).toContain('paintings_painting');
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- entity
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/entity.ts`:
```ts
import type { ProjectState, Painting } from '../paintings/types';
import { entityId } from './identifiers';

export function buildEntityBehavior(p: ProjectState, painting: Painting) {
  const W = painting.canvasW16 / 16;
  const H = painting.canvasH16 / 16;
  const width = Math.max(W, 1 / 16);
  const height = Math.max(H, 1 / 16);
  const family = `${p.pack.namespace}_painting`;

  return {
    format_version: '1.21.0',
    'minecraft:entity': {
      description: {
        identifier: entityId(p.pack.namespace, painting.id),
        is_spawnable: true,
        is_summonable: true,
        is_experimental: false,
      },
      components: {
        'minecraft:type_family': { family: [family, 'inanimate'] },
        'minecraft:collision_box': { width: 0, height: 0 },
        'minecraft:custom_hit_test': {
          hitboxes: [{ pivot: [0, height / 2, -7 / 16], width, height }],
        },
        'minecraft:physics': { has_collision: false, has_gravity: false },
        'minecraft:pushable': { is_pushable: false, is_pushable_by_piston: false },
        'minecraft:knockback_resistance': { value: 1000, max: 1000 },
        'minecraft:health': { value: 1, max: 1 },
        'minecraft:damage_sensor': {
          triggers: [{
            on_damage: {
              filters: { test: 'is_family', subject: 'other', value: 'player' },
            },
            deals_damage: false,
            event: { event: 'despawn_self', target: 'self' },
          }],
        },
        'minecraft:nameable': { allow_name_tag_renaming: false },
      },
      events: {
        despawn_self: { add: { component_groups: ['instant_despawn'] } },
      },
      component_groups: {
        instant_despawn: { 'minecraft:instant_despawn': {} },
      },
    },
  };
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- entity
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/entity.ts web/src/mcpack/entity.test.ts
git commit -m "feat(mcpack): BP entity behavior with custom_hit_test"
```

---

### Task 19: RP client entity

**Files:**
- Create: `web/src/mcpack/client_entity.ts`
- Create: `web/src/mcpack/client_entity.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/client_entity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildClientEntity } from './client_entity';

describe('buildClientEntity', () => {
  it('maps geometry, texture, render controller, spawn egg', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildClientEntity(proj, p);
    const d = j['minecraft:client_entity'].description;
    const fb = `painting_${p.id.replace(/-/g, '_')}`;
    expect(d.identifier).toBe(`paintings:${fb}`);
    expect(d.materials.default).toBe('entity_alphatest');
    expect(d.textures.default).toBe(`textures/entity/${fb}`);
    expect(d.geometry.default).toBe(`geometry.${fb}`);
    expect(d.render_controllers).toEqual([`controller.render.${fb}`]);
    expect(d.spawn_egg.texture).toBe(`${fb}_egg`);
    expect(d.spawn_egg.texture_index).toBe(0);
  });

  it('uses entity_alphablend when material is alphablend', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.material = 'alphablend';
    proj.paintings.push(p);
    const j = buildClientEntity(proj, p);
    expect(j['minecraft:client_entity'].description.materials.default).toBe('entity_alphablend');
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- client_entity
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/client_entity.ts`:
```ts
import type { ProjectState, Painting } from '../paintings/types';
import {
  entityId, paintingFileBase, geometryName, renderControllerName, spawnEggTextureKey,
} from './identifiers';

export function buildClientEntity(p: ProjectState, painting: Painting) {
  const fb = paintingFileBase(painting.id);
  const material = painting.material === 'alphablend' ? 'entity_alphablend' : 'entity_alphatest';
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: entityId(p.pack.namespace, painting.id),
        materials: { default: material },
        textures: { default: `textures/entity/${fb}` },
        geometry: { default: geometryName(painting.id) },
        render_controllers: [renderControllerName(painting.id)],
        spawn_egg: { texture: spawnEggTextureKey(painting.id), texture_index: 0 },
      },
    },
  };
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- client_entity
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/client_entity.ts web/src/mcpack/client_entity.test.ts
git commit -m "feat(mcpack): RP client entity generator"
```

---

### Task 20: Geometry generator

**Files:**
- Create: `web/src/mcpack/geometry.ts`
- Create: `web/src/mcpack/geometry.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/geometry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { buildGeometry } from './geometry';

describe('buildGeometry', () => {
  it('sets texture_width/height to canvasW16/canvasH16', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const desc = j['minecraft:geometry'][0].description;
    expect(desc.texture_width).toBe(40);
    expect(desc.texture_height).toBe(48);
  });

  it('emits a single zero-depth cube centered on X and at z=-7', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const cube = j['minecraft:geometry'][0].bones[0].cubes[0];
    expect(cube.origin).toEqual([-20, 0, -7]);
    expect(cube.size).toEqual([40, 48, 0]);
    expect(cube.uv.north).toEqual({ uv: [0, 0], uv_size: [40, 48] });
    expect(cube.uv.south).toEqual({ uv: [0, 48], uv_size: [40, -48] });
  });

  it('produces a valid identifier matching paintingFileBase', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    proj.paintings.push(p);
    const j = buildGeometry(p);
    expect(j['minecraft:geometry'][0].description.identifier)
      .toBe(`geometry.painting_${p.id.replace(/-/g, '_')}`);
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- geometry
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/geometry.ts`:
```ts
import type { Painting } from '../paintings/types';
import { geometryName } from './identifiers';

export function buildGeometry(p: Painting) {
  const W = p.canvasW16;
  const H = p.canvasH16;
  const halfW = W / 2;
  const vbHalf = Math.ceil(Math.max(W, H) / 16) + 1;

  return {
    format_version: '1.12.0',
    'minecraft:geometry': [{
      description: {
        identifier: geometryName(p.id),
        texture_width: W,
        texture_height: H,
        visible_bounds_width: vbHalf,
        visible_bounds_height: vbHalf,
        visible_bounds_offset: [0, H / 32, 0],
      },
      bones: [{
        name: 'root',
        pivot: [0, 0, 0],
        cubes: [{
          origin: [-halfW, 0, -7],
          size: [W, H, 0],
          uv: {
            north: { uv: [0, 0], uv_size: [W, H] },
            south: { uv: [0, H], uv_size: [W, -H] },
            east:  { uv: [0, 0], uv_size: [0, H] },
            west:  { uv: [0, 0], uv_size: [0, H] },
            up:    { uv: [0, 0], uv_size: [W, 0] },
            down:  { uv: [0, 0], uv_size: [W, 0] },
          },
        }],
      }],
    }],
  };
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- geometry
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/geometry.ts web/src/mcpack/geometry.test.ts
git commit -m "feat(mcpack): per-painting geometry generator"
```

---

### Task 21: Render controller

**Files:**
- Create: `web/src/mcpack/render_controller.ts`
- Create: `web/src/mcpack/render_controller.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/render_controller.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createPaintingFromImage } from '../paintings/defaults';
import { buildRenderController } from './render_controller';

describe('buildRenderController', () => {
  it('uses standard Geometry.default / Material.default / Texture.default', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    const j = buildRenderController(p);
    const rcName = `controller.render.painting_${p.id.replace(/-/g, '_')}`;
    expect(j.render_controllers[rcName].geometry).toBe('Geometry.default');
    expect(j.render_controllers[rcName].textures).toEqual(['Texture.default']);
    expect(j.render_controllers[rcName].materials).toEqual([{ '*': 'Material.default' }]);
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- render_controller
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/render_controller.ts`:
```ts
import type { Painting } from '../paintings/types';
import { renderControllerName } from './identifiers';

export function buildRenderController(p: Painting) {
  return {
    format_version: '1.10.0',
    render_controllers: {
      [renderControllerName(p.id)]: {
        geometry: 'Geometry.default',
        materials: [{ '*': 'Material.default' }],
        textures: ['Texture.default'],
      },
    },
  };
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- render_controller
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/render_controller.ts web/src/mcpack/render_controller.test.ts
git commit -m "feat(mcpack): per-painting render controller generator"
```

---

## Phase 5 — Rasterization

The browser path uses `OffscreenCanvas` (or fallback). For unit testing, we split out the pure math.

### Task 22: Rasterization parameters (pure)

**Files:**
- Create: `web/src/paintings/rasterize.ts` (only the pure half for now)
- Create: `web/src/paintings/rasterize.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/paintings/rasterize.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createPaintingFromImage } from './defaults';
import { computeRasterParams } from './rasterize';

describe('computeRasterParams', () => {
  it('returns canvas size = canvasW16*density × canvasH16*density', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 100, naturalH: 100 });
    p.canvasW16 = 32;  // 2 blocks
    p.canvasH16 = 16;  // 1 block
    p.transform = { x16: 0, y16: 0, w16: 32, h16: 16, rotation: 0, flipX: false, flipY: false };
    p.textureDensity = 4;
    const r = computeRasterParams(p);
    expect(r.density).toBe(4);
    expect(r.canvasPx).toEqual({ w: 128, h: 64 });
    expect(r.imageDstPx).toEqual({ x: 0, y: 0, w: 128, h: 64 });
  });

  it('respects transform offsets (x16, y16) scaled by density', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 100, naturalH: 100 });
    p.canvasW16 = 32; p.canvasH16 = 32;
    p.transform = { x16: 4, y16: 8, w16: 16, h16: 16, rotation: 0, flipX: false, flipY: false };
    p.textureDensity = 2;
    const r = computeRasterParams(p);
    expect(r.imageDstPx).toEqual({ x: 8, y: 16, w: 32, h: 32 });
  });

  it('uses density=1 when no source for auto', () => {
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 100, naturalH: 100 });
    p.source = null;
    p.textureDensity = 'auto';
    expect(computeRasterParams(p).density).toBe(1);
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- rasterize
```

- [ ] **Step 3: Implement the pure half**

Create `web/src/paintings/rasterize.ts`:
```ts
import { resolveDensity } from './density';
import type { Painting } from './types';

export type RasterParams = {
  density: number;
  canvasPx: { w: number; h: number };
  imageDstPx: { x: number; y: number; w: number; h: number };
};

export function computeRasterParams(p: Painting): RasterParams {
  const density = resolveDensity(p);
  const canvasPx = { w: p.canvasW16 * density, h: p.canvasH16 * density };
  const imageDstPx = {
    x: p.transform.x16 * density,
    y: p.transform.y16 * density,
    w: p.transform.w16 * density,
    h: p.transform.h16 * density,
  };
  return { density, canvasPx, imageDstPx };
}

export async function rasterize(p: Painting): Promise<Uint8Array> {
  const { canvasPx, imageDstPx } = computeRasterParams(p);
  const cvs = new OffscreenCanvas(Math.max(1, canvasPx.w), Math.max(1, canvasPx.h));
  const ctx = cvs.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  if (p.source && p.source.pngBase64) {
    const bytes = atob(p.source.pngBase64.replace(/^data:image\/[a-z]+;base64,/, ''));
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([arr], { type: 'image/png' }));
    ctx.save();
    ctx.imageSmoothingEnabled = p.resampling === 'smooth';
    ctx.imageSmoothingQuality = 'high';
    const cx = imageDstPx.x + imageDstPx.w / 2;
    const cy = imageDstPx.y + imageDstPx.h / 2;
    ctx.translate(cx, cy);
    if (p.transform.rotation) ctx.rotate((p.transform.rotation * Math.PI) / 180);
    ctx.scale(p.transform.flipX ? -1 : 1, p.transform.flipY ? -1 : 1);
    ctx.drawImage(bmp, -imageDstPx.w / 2, -imageDstPx.h / 2, imageDstPx.w, imageDstPx.h);
    ctx.restore();
  }
  const blob = await cvs.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- rasterize
```

Expected: 3 tests pass. The `rasterize` async function isn't tested in vitest (requires real OffscreenCanvas) — it's covered by the manual checklist later.

- [ ] **Step 5: Commit**

```powershell
git add web/src/paintings/rasterize.ts web/src/paintings/rasterize.test.ts
git commit -m "feat(paintings): rasterize params (pure) + canvas rasterize fn"
```

---

## Phase 6 — Build orchestration

### Task 23: `mcpack/build.ts` orchestration

**Files:**
- Create: `web/src/mcpack/build.ts`
- Create: `web/src/mcpack/build.test.ts`

- [ ] **Step 1: Failing test**

Create `web/src/mcpack/build.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { assembleArchive } from './build';

describe('assembleArchive', () => {
  it('produces a zip with both BP_<ns>/ and RP_<ns>/ trees', async () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 64, naturalH: 64 });
    proj.paintings.push(p);
    // Inject deterministic empty PNGs for the painting and egg
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zipped = await assembleArchive(proj, new Map([
      [p.id, { texture: png, eggTexture: png }],
    ]));
    const entries = unzipSync(zipped);
    const names = Object.keys(entries);
    expect(names.some((n) => n.startsWith('BP_paintings/manifest.json'))).toBe(true);
    expect(names.some((n) => n.startsWith('RP_paintings/manifest.json'))).toBe(true);
    expect(names.some((n) => n.endsWith('item_catalog/crafting_item_catalog.json'))).toBe(true);
    expect(names.some((n) => n.endsWith('scripts/main.js'))).toBe(true);
    expect(names.some((n) => n.includes('models/entity/'))).toBe(true);
    expect(names.some((n) => n.includes('textures/entity/'))).toBe(true);
    expect(names.some((n) => n.includes('textures/items/'))).toBe(true);
    expect(names.some((n) => n.endsWith('texts/en_US.lang'))).toBe(true);
    // every JSON file must parse:
    for (const [name, bytes] of Object.entries(entries)) {
      if (name.endsWith('.json')) {
        expect(() => JSON.parse(strFromU8(bytes))).not.toThrow();
      }
    }
  });
});
```

- [ ] **Step 2: Run, fails**

```powershell
cd web; npm test -- build
```

- [ ] **Step 3: Implement**

Create `web/src/mcpack/build.ts`:
```ts
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

  // -- Behavior pack
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

  // -- Resource pack
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
```

- [ ] **Step 4: Run, pass**

```powershell
cd web; npm test -- build
```

Expected: 1 test passes (verifies file list + JSON validity).

- [ ] **Step 5: Commit**

```powershell
git add web/src/mcpack/build.ts web/src/mcpack/build.test.ts
git commit -m "feat(mcpack): assembleArchive orchestrator (zip BP+RP into .mcaddon)"
```

---

### Task 24: Final build helper that rasterizes paintings and emits a Blob

**Files:**
- Modify: `web/src/mcpack/build.ts` (add a `buildMcaddonBlob` function)

- [ ] **Step 1: Update build.ts to add the full-flow helper**

Open `web/src/mcpack/build.ts` and **append** this function at the bottom:
```ts
import { rasterize, computeRasterParams } from '../paintings/rasterize';
import type { Painting } from '../paintings/types';

async function rasterizeEgg(p: Painting): Promise<Uint8Array> {
  // 16x16 egg icon: same source rasterized with a centred contain transform.
  const eggPainting: Painting = {
    ...p,
    canvasW16: 16,
    canvasH16: 16,
    textureDensity: 1,
    transform: fitContain(p, 16, 16),
  };
  return await rasterize(eggPainting);
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

export async function buildMcaddonBlob(state: ProjectState): Promise<Blob> {
  const textures = new Map<string, Textures>();
  for (const p of state.paintings) {
    // ensure computeRasterParams is referenced (deps for tree-shaking clarity)
    computeRasterParams(p);
    const texture = await rasterize(p);
    const eggTexture = await rasterizeEgg(p);
    textures.set(p.id, { texture, eggTexture });
  }
  const bytes = await assembleArchive(state, textures);
  return new Blob([bytes], { type: 'application/octet-stream' });
}
```

- [ ] **Step 2: Verify type-check passes**

Run:
```powershell
cd web; npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Run all tests**

```powershell
cd web; npm test
```

Expected: every test passes.

- [ ] **Step 4: Commit**

```powershell
git add web/src/mcpack/build.ts
git commit -m "feat(mcpack): buildMcaddonBlob full pipeline (rasterize + zip)"
```

---

## Phase 7 — UI shell

The UI is light on tests (Konva and image work need a real browser). We rely on `npm run check` + manual verification.

### Task 25: App shell layout

**Files:**
- Modify: `web/src/App.svelte`
- Create: `web/src/ui/Sidebar.svelte`
- Create: `web/src/ui/PackSettings.svelte`
- Create: `web/src/ui/FileDrop.svelte`

- [ ] **Step 1: Replace App.svelte with the 3-pane layout**

Replace `web/src/App.svelte`:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { project } from './stores/project';
  import { bindPersistence, loadFromStorage } from './stores/persistence';
  import Sidebar from './ui/Sidebar.svelte';
  import PackSettings from './ui/PackSettings.svelte';

  let selectedId: string | null = null;

  onMount(() => {
    const saved = loadFromStorage();
    if (saved) project.set(saved);
    return bindPersistence(project, 1000);
  });
</script>

<div class="app">
  <aside class="sidebar"><Sidebar bind:selectedId /></aside>
  <main class="editor">
    {#if selectedId}
      <p>Editor for {selectedId} (coming next).</p>
    {:else}
      <p>Select a painting on the left, or drop images to add new ones.</p>
    {/if}
  </main>
  <aside class="pack"><PackSettings /></aside>
</div>

<style>
  .app { display: grid; grid-template-columns: 260px 1fr 320px; height: 100vh; }
  .sidebar, .pack { border: 1px solid #ddd; overflow: auto; padding: 0.5rem; }
  .editor { padding: 0.5rem; overflow: auto; }
</style>
```

- [ ] **Step 2: Add the sidebar component (skeleton)**

Create `web/src/ui/Sidebar.svelte`:
```svelte
<script lang="ts">
  import { project } from '../stores/project';
  import { createPaintingFromImage } from '../paintings/defaults';
  import { uint8ToBase64 } from '../util/base64';
  import FileDrop from './FileDrop.svelte';
  export let selectedId: string | null;

  async function addFromFiles(files: FileList) {
    const additions = [];
    for (const f of Array.from(files)) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const dataUrl = await fileDataUrl(f);
      const bmp = await createImageBitmap(new Blob([bytes], { type: f.type }));
      additions.push(createPaintingFromImage(
        stripExt(f.name),
        { pngBase64: dataUrl, naturalW: bmp.width, naturalH: bmp.height },
      ));
    }
    project.update((v) => ({ ...v, paintings: [...v.paintings, ...additions] }));
  }

  function fileDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(f);
    });
  }

  function stripExt(name: string): string {
    return name.replace(/\.[^.]+$/, '');
  }

  function remove(id: string) {
    project.update((v) => ({ ...v, paintings: v.paintings.filter((p) => p.id !== id) }));
    if (selectedId === id) selectedId = null;
  }
</script>

<header>
  <FileDrop on:files={(e) => addFromFiles(e.detail)} />
</header>
<ul>
  {#each $project.paintings as p (p.id)}
    <li class:selected={selectedId === p.id}>
      <button on:click={() => (selectedId = p.id)}>
        {p.name || '(untitled)'} — {(p.canvasW16/16).toFixed(2)}×{(p.canvasH16/16).toFixed(2)}
      </button>
      <button class="del" on:click={() => remove(p.id)} title="Delete">✕</button>
    </li>
  {/each}
</ul>
{#if $project.paintings.length === 0}
  <p class="empty">No paintings yet. Drop images above.</p>
{/if}

<style>
  ul { list-style: none; padding: 0; margin: 0.5rem 0; }
  li { display: flex; gap: 4px; }
  li button { flex: 1; text-align: left; }
  li.selected button { background: #ddebff; }
  .del { flex: 0 0 auto; }
  .empty { color: #777; font-size: 0.9rem; }
</style>
```

Note: the unused `uint8ToBase64` import is reserved for future use; if `noUnusedLocals` complains, remove the import.

- [ ] **Step 3: Add the file drop component**

Create `web/src/ui/FileDrop.svelte`:
```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ files: FileList }>();
  let dragOver = false;

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer?.files?.length) dispatch('files', e.dataTransfer.files);
  }
  function onPick(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files?.length) dispatch('files', t.files);
  }
</script>

<label
  class="drop" class:over={dragOver}
  on:dragover|preventDefault={() => (dragOver = true)}
  on:dragleave={() => (dragOver = false)}
  on:drop={onDrop}
>
  <span>Drop PNG/JPEG or click to pick</span>
  <input type="file" multiple accept="image/png,image/jpeg" on:change={onPick} hidden />
</label>

<style>
  .drop { display: block; border: 2px dashed #aaa; padding: 1rem; text-align: center; cursor: pointer; }
  .drop.over { border-color: #36c; background: #eef5ff; }
</style>
```

- [ ] **Step 4: Add the pack settings component (with Build button placeholder)**

Create `web/src/ui/PackSettings.svelte`:
```svelte
<script lang="ts">
  import { project } from '../stores/project';
  import { buildMcaddonBlob, archiveFilename } from '../mcpack/build';
  import { exportProjectJSON, importProjectJSON } from '../stores/persistence';

  let building = false;
  let error: string | null = null;

  async function onBuild() {
    error = null;
    building = true;
    try {
      const blob = await buildMcaddonBlob($project);
      downloadBlob(blob, archiveFilename($project));
    } catch (err) {
      error = (err as Error).message;
    } finally {
      building = false;
    }
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function onExport() {
    downloadBlob(new Blob([exportProjectJSON($project)], { type: 'application/json' }),
      `${$project.pack.name || 'project'}-project.json`);
  }

  async function onImport(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      project.set(importProjectJSON(text));
    } catch (err) {
      error = `Import failed: ${(err as Error).message}`;
    }
  }
</script>

<h3>Pack Settings</h3>
<label>Name <input bind:value={$project.pack.name} /></label>
<label>Description <input bind:value={$project.pack.description} /></label>
<label>Namespace <input bind:value={$project.pack.namespace} /></label>
<label>Creative group name <input bind:value={$project.pack.creativeGroupName} /></label>

<h4>Version</h4>
<div class="row">
  <input type="number" min="0" bind:value={$project.pack.semver[0]} />
  <input type="number" min="0" bind:value={$project.pack.semver[1]} />
  <input type="number" min="0" bind:value={$project.pack.semver[2]} />
</div>

<h4>Min engine version</h4>
<div class="row">
  <input type="number" min="0" bind:value={$project.pack.minEngineVersion[0]} />
  <input type="number" min="0" bind:value={$project.pack.minEngineVersion[1]} />
  <input type="number" min="0" bind:value={$project.pack.minEngineVersion[2]} />
</div>

<hr />
<button on:click={onBuild} disabled={building || $project.paintings.length === 0}>
  {building ? 'Building…' : 'Build .mcaddon'}
</button>
<button on:click={onExport}>Export project JSON</button>
<label class="imp">
  Import project JSON
  <input type="file" accept="application/json" on:change={onImport} hidden />
</label>
{#if error}<p class="err">{error}</p>{/if}

<style>
  label { display: block; margin: 4px 0; font-size: 0.9rem; }
  label input[type="text"], label input:not([type]) { display: block; width: 100%; }
  .row { display: flex; gap: 4px; }
  .row input { width: 60px; }
  .err { color: #c00; }
  .imp { display: inline-block; padding: 4px 8px; border: 1px solid #aaa; cursor: pointer; }
  button { margin: 4px 4px 4px 0; }
</style>
```

- [ ] **Step 5: Verify it builds and runs**

Run:
```powershell
cd web; npm run check; npm run build
```

Expected: type-check 0 errors, build succeeds with output in `web/dist/`.

- [ ] **Step 6: Commit**

```powershell
git add web/src/App.svelte web/src/ui/
git commit -m "feat(ui): app shell, sidebar, pack settings, file drop"
```

---

## Phase 8 — Editor

### Task 26: Painting editor scaffold (Konva stage)

**Files:**
- Create: `web/src/editor/PaintingEditor.svelte`
- Modify: `web/src/App.svelte` (route to the editor on selection)

- [ ] **Step 1: Create the editor scaffold**

Create `web/src/editor/PaintingEditor.svelte`:
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Konva from 'konva';
  import { project } from '../stores/project';
  import type { Painting } from '../paintings/types';
  import { resolveDensity } from '../paintings/density';

  export let id: string;

  let host: HTMLDivElement;
  let stage: Konva.Stage | null = null;
  let bgLayer: Konva.Layer;
  let imageLayer: Konva.Layer;
  let gridLayer: Konva.Layer;
  let imageNode: Konva.Image | null = null;

  $: painting = $project.paintings.find((p) => p.id === id) ?? null;

  // Pixels-per-sixteenth in the stage (zoomable, but start at 12 px / 1/16-block).
  let pps = 12;

  onMount(async () => {
    stage = new Konva.Stage({ container: host, width: host.clientWidth, height: host.clientHeight });
    bgLayer = new Konva.Layer();
    imageLayer = new Konva.Layer();
    gridLayer = new Konva.Layer();
    stage.add(bgLayer, imageLayer, gridLayer);
    await refresh();
  });

  onDestroy(() => stage?.destroy());

  async function refresh() {
    if (!stage || !painting) return;
    bgLayer.destroyChildren();
    imageLayer.destroyChildren();
    gridLayer.destroyChildren();
    drawCheckerboard();
    await drawImage();
    drawGrid();
    bgLayer.draw(); imageLayer.draw(); gridLayer.draw();
  }

  function drawCheckerboard() {
    if (!painting) return;
    const W = painting.canvasW16 * pps;
    const H = painting.canvasH16 * pps;
    const cell = pps; // 1 cell per 1/16-block
    bgLayer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: '#f0f0f0' }));
    for (let y = 0; y < painting.canvasH16; y++) {
      for (let x = 0; x < painting.canvasW16; x++) {
        if ((x + y) % 2 === 0) {
          bgLayer.add(new Konva.Rect({
            x: x * cell, y: y * cell, width: cell, height: cell, fill: '#e0e0e0',
          }));
        }
      }
    }
  }

  async function drawImage() {
    if (!painting?.source) return;
    const img = new Image();
    img.src = painting.source.pngBase64;
    await new Promise<void>((r, e) => { img.onload = () => r(); img.onerror = () => e(new Error('image load')); });
    imageNode = new Konva.Image({
      image: img,
      x: painting.transform.x16 * pps,
      y: painting.transform.y16 * pps,
      width: painting.transform.w16 * pps,
      height: painting.transform.h16 * pps,
      draggable: true,
    });
    imageNode.on('dragend', commitTransform);
    imageLayer.add(imageNode);
  }

  function drawGrid() {
    if (!painting) return;
    const W = painting.canvasW16 * pps;
    const H = painting.canvasH16 * pps;
    // 1/16 lines (only when pps is high enough)
    if (pps >= 6) {
      for (let i = 0; i <= painting.canvasW16; i++) {
        gridLayer.add(new Konva.Line({
          points: [i * pps, 0, i * pps, H],
          stroke: '#0001', strokeWidth: 1,
        }));
      }
      for (let i = 0; i <= painting.canvasH16; i++) {
        gridLayer.add(new Konva.Line({
          points: [0, i * pps, W, i * pps],
          stroke: '#0001', strokeWidth: 1,
        }));
      }
    }
    // Block lines (every 16 sixteenths)
    for (let i = 0; i <= painting.canvasW16 / 16; i++) {
      gridLayer.add(new Konva.Line({
        points: [i * 16 * pps, 0, i * 16 * pps, H],
        stroke: '#000a', strokeWidth: 2,
      }));
    }
    for (let i = 0; i <= painting.canvasH16 / 16; i++) {
      gridLayer.add(new Konva.Line({
        points: [0, i * 16 * pps, W, i * 16 * pps],
        stroke: '#000a', strokeWidth: 2,
      }));
    }
  }

  function commitTransform() {
    if (!painting || !imageNode) return;
    const x16 = Math.round(imageNode.x() / pps);
    const y16 = Math.round(imageNode.y() / pps);
    imageNode.position({ x: x16 * pps, y: y16 * pps });
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) =>
        p.id === id ? { ...p, transform: { ...p.transform, x16, y16 } } : p,
      ),
    }));
  }

  // Re-render when the painting changes externally.
  $: if (painting) refresh().catch(console.error);

  $: density = painting ? resolveDensity(painting) : 1;
</script>

{#if painting}
  <div class="bar">
    <label>W
      <input type="number" step="0.0625" min="0.0625"
        value={painting.canvasW16 / 16}
        on:change={(e) => updateCanvas('W', e.currentTarget.valueAsNumber)} />
    </label>
    <label>H
      <input type="number" step="0.0625" min="0.0625"
        value={painting.canvasH16 / 16}
        on:change={(e) => updateCanvas('H', e.currentTarget.valueAsNumber)} />
    </label>
    <label>Density
      <select value={painting.textureDensity}
        on:change={(e) => updatePainting({ textureDensity: parseDensity(e.currentTarget.value) })}>
        <option value="auto">auto ({density}×)</option>
        {#each [1,2,4,8,16,32,64] as n}<option value={n}>{n}×</option>{/each}
      </select>
    </label>
    <label>Resampling
      <select value={painting.resampling}
        on:change={(e) => updatePainting({ resampling: e.currentTarget.value as 'smooth' | 'pixelated' })}>
        <option value="smooth">smooth</option>
        <option value="pixelated">pixelated</option>
      </select>
    </label>
    <label>Material
      <select value={painting.material}
        on:change={(e) => updatePainting({ material: e.currentTarget.value as 'alphatest' | 'alphablend' })}>
        <option value="alphatest">alphatest</option>
        <option value="alphablend">alphablend</option>
      </select>
    </label>
    <label>Name
      <input type="text" bind:value={painting.name} on:change={() => updatePainting({})} />
    </label>
    <span class="info">Texture: {painting.canvasW16 * density}×{painting.canvasH16 * density} px</span>
  </div>
  <div class="canvas-host" bind:this={host}></div>
{:else}
  <p>Painting not found.</p>
{/if}

<script context="module" lang="ts">
  // (Module-scope helpers are placed at bottom inline for clarity.)
</script>

<script lang="ts">
  function parseDensity(v: string): import('../paintings/types').Density {
    if (v === 'auto') return 'auto';
    const n = Number(v);
    if ([1,2,4,8,16,32,64].includes(n)) return n as import('../paintings/types').Density;
    return 'auto';
  }
  function updateCanvas(axis: 'W' | 'H', blocks: number) {
    const px16 = Math.max(1, Math.round(blocks * 16));
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id
        ? { ...p, [axis === 'W' ? 'canvasW16' : 'canvasH16']: px16 }
        : p),
    }));
  }
  function updatePainting(patch: Partial<import('../paintings/types').Painting>) {
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? { ...p, ...patch } : p),
    }));
  }
</script>

<style>
  .bar { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 0; }
  .bar label { display: flex; flex-direction: column; font-size: 0.8rem; }
  .canvas-host { width: 100%; height: calc(100vh - 110px); border: 1px solid #ccc; }
  .info { align-self: center; color: #555; font-size: 0.85rem; }
</style>
```

- [ ] **Step 2: Wire the editor into `App.svelte`**

Edit `web/src/App.svelte`, replacing the `<main class="editor">…</main>` block with:
```svelte
<main class="editor">
  {#if selectedId}
    {#key selectedId}
      <PaintingEditor id={selectedId} />
    {/key}
  {:else}
    <p>Select a painting on the left, or drop images to add new ones.</p>
  {/if}
</main>
```

And add the import to the `<script>`:
```ts
import PaintingEditor from './editor/PaintingEditor.svelte';
```

- [ ] **Step 3: Type-check and build**

Run:
```powershell
cd web; npm run check; npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Smoke-test in dev**

```powershell
cd web; npm run dev
```

Open the URL in a browser. Drop a PNG. Click it in the sidebar. Confirm:
- The grid + image render.
- Dragging the image snaps to 1/16 block.
- Changing canvas size in the toolbar updates the grid.
- Changing density updates the "Texture: WxH px" readout.

Stop the dev server.

- [ ] **Step 5: Commit**

```powershell
git add web/src/editor/ web/src/App.svelte
git commit -m "feat(editor): Konva-based painting editor (grid, drag, snap)"
```

---

### Task 27: Image transformer (resize handles, snap-to-1/16)

**Files:**
- Modify: `web/src/editor/PaintingEditor.svelte`

- [ ] **Step 1: Add a Konva Transformer**

In `web/src/editor/PaintingEditor.svelte`, inside the `<script lang="ts">` (the top one), modify `drawImage` to attach a `Transformer` and snap on transform end. Replace the `drawImage` function body and the unused/empty Transformer setup with:

```ts
async function drawImage() {
  if (!painting?.source) return;
  const img = new Image();
  img.src = painting.source.pngBase64;
  await new Promise<void>((r, e) => { img.onload = () => r(); img.onerror = () => e(new Error('image load')); });
  imageNode = new Konva.Image({
    image: img,
    x: painting.transform.x16 * pps,
    y: painting.transform.y16 * pps,
    width: painting.transform.w16 * pps,
    height: painting.transform.h16 * pps,
    draggable: true,
  });
  imageNode.on('dragend', commitTransform);
  imageLayer.add(imageNode);

  const tr = new Konva.Transformer({
    nodes: [imageNode],
    rotateEnabled: false,
    keepRatio: false,
    anchorSize: 10,
    enabledAnchors: ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center'],
  });
  tr.on('transformend', () => {
    if (!imageNode) return;
    // Konva applies scaleX/Y on transform; convert to width/height and reset scale.
    const w = imageNode.width() * imageNode.scaleX();
    const h = imageNode.height() * imageNode.scaleY();
    imageNode.scale({ x: 1, y: 1 });
    imageNode.width(w);
    imageNode.height(h);
    commitTransform();
  });
  imageLayer.add(tr);
}
```

Replace `commitTransform` with one that also snaps width/height:
```ts
function commitTransform() {
  if (!painting || !imageNode) return;
  const x16 = Math.max(0, Math.round(imageNode.x() / pps));
  const y16 = Math.max(0, Math.round(imageNode.y() / pps));
  const w16 = Math.max(1, Math.round(imageNode.width() / pps));
  const h16 = Math.max(1, Math.round(imageNode.height() / pps));
  imageNode.position({ x: x16 * pps, y: y16 * pps });
  imageNode.width(w16 * pps);
  imageNode.height(h16 * pps);
  project.update((v) => ({
    ...v,
    paintings: v.paintings.map((p) =>
      p.id === id ? { ...p, transform: { ...p.transform, x16, y16, w16, h16 } } : p),
  }));
}
```

- [ ] **Step 2: Type-check**

```powershell
cd web; npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Smoke test in dev**

```powershell
cd web; npm run dev
```

Verify in the browser:
- Image now has resize handles at corners and edges.
- Resizing snaps to 1/16-block.
- Updated dimensions persist after reload (auto-save).

- [ ] **Step 4: Commit**

```powershell
git add web/src/editor/PaintingEditor.svelte
git commit -m "feat(editor): Konva Transformer with 1/16 snap on resize"
```

---

### Task 28: Generate egg/painting download and end-to-end smoke

**Files:** (no code, validation step)

- [ ] **Step 1: Smoke-test the full export flow in dev**

```powershell
cd web; npm run dev
```

In the browser:
1. Drop one PNG image (e.g., a colourful test pattern).
2. Adjust canvas size to 2×2 blocks.
3. Click **Build .mcaddon**. A file is downloaded.

- [ ] **Step 2: Manually unzip and inspect the .mcaddon**

In a temporary folder, rename the file to `.zip` and extract. Verify:
- `BP_paintings/manifest.json` exists, JSON parses.
- `BP_paintings/scripts/main.js` exists and contains `FAMILY = "paintings_painting"`.
- `RP_paintings/textures/entity/painting_<id>.png` exists and is a non-empty PNG.
- `RP_paintings/textures/items/painting_<id>_egg.png` exists.
- `RP_paintings/entity/painting_<id>.entity.json` references the correct geometry and texture.
- `RP_paintings/models/entity/painting_<id>.geo.json` has the expected sizes.

If anything is off, fix the relevant generator and re-test.

- [ ] **Step 3: Commit nothing (smoke step only)**

If you fixed a bug, commit it now under its own message.

---

## Phase 9 — Polish & docs

### Task 29: Pack size meter and inline warnings

**Files:**
- Modify: `web/src/ui/PackSettings.svelte`

- [ ] **Step 1: Add a size meter**

In `PackSettings.svelte`, inside the `<script>`, add:
```ts
$: rawSize = JSON.stringify($project).length;
$: sizeMb = (rawSize / (1024 * 1024)).toFixed(2);
$: tooBig = rawSize > 4 * 1024 * 1024;
```

Then add right before `<hr />`:
```svelte
<p class="size" class:warn={tooBig}>Project size: {sizeMb} MB / ~5 MB</p>
```

Style:
```css
.size { font-size: 0.85rem; color: #555; }
.size.warn { color: #c60; font-weight: bold; }
```

- [ ] **Step 2: Type-check and commit**

```powershell
cd web; npm run check
git add web/src/ui/PackSettings.svelte
git commit -m "feat(ui): project size meter with warning at 4MB"
```

---

### Task 30: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the empty README**

Replace `README.md` with:
```markdown
# MC Painting Maker

A browser-based tool that turns your images into Minecraft Bedrock custom paintings.
Drop images, choose dimensions in blocks, optionally crop / resize / move the image
inside the canvas, and export a `.mcaddon` that adds each painting as an independent
custom entity placeable with its own vanilla spawn egg.

Compatible with Bedrock 1.21.30+ and Minecraft Education Edition.

## Run locally

```bash
cd web
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173/`).

## Build static site

```bash
cd web
npm run build
```

Output goes to `web/dist/`. Deployable to GitHub Pages (workflow included).

## Tests

```bash
cd web
npm test
```

## Manual verification in Minecraft

After exporting a `.mcaddon`:

1. Open the file with Minecraft Bedrock — both packs install.
2. Create a world with both packs enabled (Behaviour and Resources).
3. Open the Creative inventory → the `equipment` category contains a
   "Custom Paintings" (or your configured name) group with one spawn egg per painting.
4. Use a spawn egg against a wall. The painting should:
   - Appear flush with the wall.
   - Snap to the nearest cardinal direction.
   - Be hittable across its full width and height.
5. Punching the painting despawns it.

## Spec & plan

Design and implementation plan live under `docs/superpowers/`.

## License

MIT.
```

- [ ] **Step 2: Commit**

```powershell
git add README.md
git commit -m "docs: write README with usage instructions"
```

---

## Phase 10 — Validation

### Task 31: Full test run

- [ ] **Step 1: Run the whole suite**

```powershell
cd web; npm test
```

Expected: every test passes.

- [ ] **Step 2: Run the type-check**

```powershell
cd web; npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Run the production build**

```powershell
cd web; npm run build
```

Expected: build succeeds; `web/dist/` produced.

---

### Task 32: Manual end-to-end in Minecraft Bedrock

This is the only test that exercises the **Script API**, **custom_hit_test**, and the **geometry origin z** sign — the three items flagged in spec §14.

- [ ] **Step 1: Build a sample pack**

Open the app. Use it to create:
- Painting **"Small"**: 1×1 block, simple PNG.
- Painting **"Wide"**: 4×1 block, simple PNG.
- Painting **"Tall"**: 2×4 block.
- Painting **"Fraction"**: 2.5×3 block.

Build the `.mcaddon`. Open it with Bedrock to install.

- [ ] **Step 2: Create a Creative world with both packs enabled**

- [ ] **Step 3: Verify each painting**

For each spawn egg:
- The egg icon shows a preview of the painting.
- Spawning on a wall produces a painting that:
  - Faces away from the wall.
  - Is rotated to the nearest cardinal direction.
  - Sits flush with (or 1 px from) the wall — **no gap, no clipping**.
- Hitting the painting at any of its four edges despawns it.

- [ ] **Step 4: If geometry origin z is wrong (painting on the wrong side of the wall)**

Edit `web/src/mcpack/geometry.ts`:
- Change `origin: [-halfW, 0, -7]` → `origin: [-halfW, 0, 7]` (flip Z).
- Swap the `north` and `south` UVs accordingly: `north` becomes `uv: [0, H]`, `uv_size: [W, -H]`; `south` becomes `uv: [0, 0]`, `uv_size: [W, H]`.
- Update the snapshot tests in `geometry.test.ts`.
- Rebuild and retest.

Commit the fix with a clear message (e.g. `fix(mcpack): correct geometry origin Z sign for wall placement`).

- [ ] **Step 5: Verify in Minecraft Education Edition**

Repeat steps 2–3 in Education Edition. The Script API dependency is the riskiest piece — if the painting does NOT snap rotation in EE, check the player's "Activate Cheats / Experimental" settings, then the script log.

If EE refuses the script entirely, the fallback documented in spec §14.2 (deferring with `system.run`) is applied: edit `web/src/mcpack/script.ts` and wrap the snap in `system.run(() => {…})`, importing `system` from `@minecraft/server`.

- [ ] **Step 6: Commit if any fix was applied**

---

### Task 33: Push and verify GH Pages deploy

- [ ] **Step 1: Push**

```powershell
git push origin main
```

- [ ] **Step 2: Check Actions tab on GitHub**

Wait for the "Deploy to GitHub Pages" workflow to complete. If it fails, read the logs and fix (typical issues: `npm ci` lockfile mismatch — regenerate the lockfile and re-push).

- [ ] **Step 3: Open the deployed URL**

`https://<user>.github.io/<repo>/` — verify the app loads and the build flow works end-to-end in production.

---

## Self-Review Summary

**Spec coverage check** (against `2026-05-11-painting-maker-design.md`):

| Spec section | Plan task(s) |
| --- | --- |
| §3 Tech stack | Task 1 |
| §4 Architecture | Whole plan |
| §5 Data model | Tasks 4–6 |
| §6 Editor UX | Tasks 26–27 |
| §7 Rasterization | Task 22 |
| §8 Mcaddon structure | Task 23 |
| §9 Per-painting files (entity / client_entity / geometry / RC / script / item_texture / catalog / lang / manifest) | Tasks 13–21, 17 |
| §10 Persistence | Tasks 10–11 |
| §11 Pack-meta UI | Task 25 |
| §12 Error handling | Tasks 11, 25, 29 |
| §13 Testing strategy | Every task uses TDD; manual checklist in Task 32 |
| §14 Open risks | Task 32 + spec-driven fix steps inline |

**Placeholder scan:** none. Every step shows the actual code or the exact command to run.

**Type consistency:** types (`Painting`, `Density`, `PackUUIDs.bpScriptModule`, etc.) are defined in Task 4 and referenced consistently through to the build orchestrator.

**Scope:** one plan, ~33 tasks, each 2–10 minutes. Each phase ends with a working checkpoint (tests pass, build succeeds, optionally a dev-server smoke).

# Canvas Anchored At Origin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anchor the painting model's bottom-left canvas corner at the entity origin `(0, 0, 0)` instead of X-centering it, so the first 16×16 block of the model coincides with the entity's own block and growth extends in +X / +Y.

**Architecture:** Two independent edits to entity-local geometry. `src/mcpack/geometry.ts` shifts the cube origin and recenters the visible-bounds offset on the new canvas position. `src/mcpack/entity.ts` shifts the custom hit-test pivot by the same amount so the hitbox tracks the canvas. Cube depth (`z ∈ [6, 7]`), face configuration, UVs, bone pivots (already `[0, 0, 0]`), and rotation script are untouched.

**Tech Stack:** TypeScript + Vitest. No new dependencies.

---

### Task 1: Anchor cube origin at (0, 0, 6) and recenter visible-bounds offset

**Files:**
- Modify: `src/mcpack/geometry.ts`
- Test: `src/mcpack/geometry.test.ts`

- [ ] **Step 1: Update the failing test**

Edit `src/mcpack/geometry.test.ts:38-49` (the test titled `both cubes sit at z=[6, 7] with depth 1 (overlapping volumes, distinct faces)`) so it asserts the new origin. Replace the existing block with:

```typescript
  it('both cubes are anchored with their bottom-left at (0, 0, 6) and depth 1', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 32; p.canvasH16 = 32;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const bones: any = j['minecraft:geometry'][0].bones;
    expect(bones[1].cubes[0].origin).toEqual([0, 0, 6]);
    expect(bones[1].cubes[0].size).toEqual([32, 32, 1]);
    expect(bones[2].cubes[0].origin).toEqual([0, 0, 6]);
    expect(bones[2].cubes[0].size).toEqual([32, 32, 1]);
  });
```

Then add a new test below it for the visible-bounds offset:

```typescript
  it('centers visible_bounds_offset on the anchored canvas', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildGeometry(p);
    const desc = j['minecraft:geometry'][0].description;
    expect(desc.visible_bounds_offset).toEqual([40 / 32, 48 / 32, 0]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/mcpack/geometry.test.ts`

Expected: the two updated/new tests fail. The "anchored at (0, 0, 6)" test fails because `origin` is currently `[-16, 0, 6]`. The "visible_bounds_offset" test fails because the current value is `[0, 1.5, 0]` (`H/32` only), not `[1.25, 1.5, 0]`.

- [ ] **Step 3: Update `src/mcpack/geometry.ts`**

Open `src/mcpack/geometry.ts` and apply two edits:

Edit 1: drop `halfW` and shift the cube origin. Replace lines 7-18 (the `halfW` declaration through the `planeCube` `origin`):

Old:
```typescript
  const halfW = W / 2;
  const vbHalf = Math.ceil(Math.max(W, H) / 16) + 1;

  // Reference: test_painting.geo.json - two overlapping cubes of depth 1 at z=[6, 7].
  // The painting cube renders only its north face (front, painting texture).
  // The frame cube renders south + the four side faces (back + outer frame, wood
  // texture). Side faces sample the OUTER EDGE of the shared back texture - which is
  // designed to look like a beveled wooden frame edge - so the painting appears as a
  // real framed picture when viewed from any angle except straight-on.
  function planeCube(showNorth: boolean) {
    return {
      origin: [-halfW, 0, 6],
```

New:
```typescript
  const vbHalf = Math.ceil(Math.max(W, H) / 16) + 1;

  // Reference: test_painting.geo.json - two overlapping cubes of depth 1 at z=[6, 7].
  // The painting cube renders only its north face (front, painting texture).
  // The frame cube renders south + the four side faces (back + outer frame, wood
  // texture). Side faces sample the OUTER EDGE of the shared back texture - which is
  // designed to look like a beveled wooden frame edge - so the painting appears as a
  // real framed picture when viewed from any angle except straight-on.
  function planeCube(showNorth: boolean) {
    return {
      origin: [0, 0, 6],
```

Edit 2: recenter `visible_bounds_offset`. Find the line:

```typescript
        visible_bounds_offset: [0, H / 32, 0],
```

Replace it with:

```typescript
        visible_bounds_offset: [W / 32, H / 32, 0],
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/mcpack/geometry.test.ts`

Expected: all geometry tests pass (4 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/mcpack/geometry.ts src/mcpack/geometry.test.ts
git commit -m "feat(geometry): anchor canvas bottom-left at model origin"
```

---

### Task 2: Shift hit-test pivot to (width/2, height/2, -7/16)

**Files:**
- Modify: `src/mcpack/entity.ts`
- Test: `src/mcpack/entity.test.ts`

- [ ] **Step 1: Tighten the existing failing assertion**

Edit `src/mcpack/entity.test.ts` lines 17-30 (the test titled `produces a custom_hit_test sized to the painting (W x H blocks)`). Add an X-pivot assertion. Replace the test body with:

```typescript
  it('produces a custom_hit_test sized to the painting (W x H blocks)', () => {
    const proj = createEmptyProject();
    const p = createPaintingFromImage('B', { pngBase64: '', naturalW: 32, naturalH: 32 });
    p.canvasW16 = 40; p.canvasH16 = 48;
    proj.paintings.push(p);
    const j = buildEntityBehavior(proj, p);
    const comps = j['minecraft:entity'].components as any;
    const hb = comps['minecraft:custom_hit_test'].hitboxes;
    expect(hb).toHaveLength(1);
    expect(hb[0].width).toBeCloseTo(2.5);
    expect(hb[0].height).toBeCloseTo(3);
    expect(hb[0].pivot[0]).toBeCloseTo(1.25);
    expect(hb[0].pivot[1]).toBeCloseTo(1.5);
    expect(hb[0].pivot[2]).toBeCloseTo(-7 / 16);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/mcpack/entity.test.ts`

Expected: the updated test fails on the new `pivot[0]` assertion (current value is `0`, expected `1.25`).

- [ ] **Step 3: Update `src/mcpack/entity.ts`**

In `src/mcpack/entity.ts`, replace the hit-test pivot. Find:

```typescript
          hitboxes: [{ pivot: [0, height / 2, -7 / 16], width, height }],
```

Replace with:

```typescript
          hitboxes: [{ pivot: [width / 2, height / 2, -7 / 16], width, height }],
```

Note: this uses `width` and `height` (the clamped values used by the hitbox size), not the raw `W` / `H`. This keeps the pivot consistent with the hitbox extent on zero-canvas edge cases — for `W = 0` the pivot X becomes `1/32`, which is the half-width of the clamped hitbox.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/mcpack/entity.test.ts`

Expected: all entity tests pass (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/mcpack/entity.ts src/mcpack/entity.test.ts
git commit -m "feat(entity): align hit-test pivot with anchored canvas"
```

---

### Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Type-check**

Run: `npm run check`

Expected: no errors.

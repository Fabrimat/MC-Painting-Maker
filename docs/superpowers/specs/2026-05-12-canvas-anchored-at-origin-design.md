## Goal

The exported painting model anchors the canvas's bottom-left corner at the entity origin `(0, 0, 0)` and extends in the +X / +Y direction. Bone pivots remain at `(0, 0, 0)`. Today the canvas is X-centered, which makes the entity origin sit in the middle of the painting and produces unpredictable per-block alignment for multi-block paintings.

## Motivation

When a creator places a multi-block painting in the world, the natural mental model is "the entity sits in one block, and the painting grows from there." With the canvas centered on the entity's X axis, the entity actually sits halfway between blocks for any painting wider than 1 block, which is surprising and makes alignment finicky. Anchoring the bottom-left corner at the origin makes the first block of the model coincide with the entity's own block, and growth happens predictably toward the player's left (+X in Bedrock entity space, since the front faces -Z) and upward (+Y).

This also keeps the rotation behavior intuitive: with all bone pivots at `(0, 0, 0)`, the entity rotates around its own block, and the bottom-left anchor stays fixed.

## Non-goals

- No change to cube depth, the z=[6, 7] split between front and back, or UV mappings.
- No change to the texture export pipeline, editor preview, or block-summon UX.
- No change to `script.ts` rotation snapping. Rotation already happens around the bone pivots at the origin.
- No change to the manifest, catalog, or any other addon file.

## Coordinate convention

Bedrock entity space, front faces -Z (north). For a player standing south of the entity and looking at the painting:

- +X is to the player's **left**.
- +Y is **up**.
- -Z is **into** the painting (toward the player).

The canvas occupies `x ∈ [0, W]`, `y ∈ [0, H]`, `z ∈ [6, 7]`, where `W = canvasW16` and `H = canvasH16` are pixel-units (1 block = 16 units). The bottom-left corner of the canvas is at `(0, 0, 6)`, which coincides with the bottom-left of the entity's own block.

## File changes

### `src/mcpack/geometry.ts`

- `planeCube`: cube `origin` becomes `[0, 0, 6]` instead of `[-halfW, 0, 6]`. The `size` stays `[W, H, 1]`. The `halfW` local is no longer needed and is removed.
- `description.visible_bounds_offset` becomes `[W / 32, H / 32, 0]` instead of `[0, H / 32, 0]`. This keeps the visible-bounds box centered on the canvas (the canvas center is now at `(W/2, H/2)` in entity space, i.e. `(W/32, H/32)` in blocks).
- `visible_bounds_width` / `visible_bounds_height` (the `vbHalf` calculation) stay unchanged. They already account for the full canvas extent plus a 1-block margin, which is sufficient regardless of where the canvas is anchored.
- Bone pivots stay at `[0, 0, 0]` for `root`, `front`, `back`. UVs stay unchanged.

### `src/mcpack/entity.ts`

- The custom hit test pivot moves from `[0, height/2, -7/16]` to `[width/2, height/2, -7/16]`, so the hitbox stays centered on the actual canvas position. The hitbox width and height are unchanged.

### Tests

- `src/mcpack/geometry.test.ts`: the "both cubes sit at z=[6, 7]" test currently asserts `origin === [-16, 0, 6]` for a 32×32 painting. Update to `[0, 0, 6]` for both `front` and `back` cubes. The other tests (texture dimensions, identifier, face configuration) are unaffected.
- `src/mcpack/entity.test.ts`: the "produces a custom_hit_test sized to the painting" test currently asserts `pivot[1] ≈ 1.5` and `pivot[2] ≈ -7/16` but does not check `pivot[0]`. Add an assertion that `pivot[0] ≈ width/2`. For the 40×48 case, `width = 40/16 = 2.5`, so `pivot[0] ≈ 1.25`.

## Edge cases

- **1×1 painting (W=H=16):** canvas at `(0, 0, 6)` to `(16, 16, 7)` in entity space. Hitbox pivot at `(0.5, 0.5, -7/16)`. Visible-bounds offset `(0.5, 0.5, 0)`. The painting spans exactly 1 block in X and Y, anchored at the model origin instead of straddling it.
- **Zero-canvas painting (W=0 or H=0):** hitbox width/height are clamped to 1/16 (existing behavior). The pivot uses the raw `width/2` and `height/2`, which are `0` when the corresponding dimension is `0`; that happens to match the existing pivot value for the same component, so the degenerate-axis behavior is unchanged.
- **Wide or tall paintings (W > H or vice versa):** `vbHalf` still picks the larger dimension + 1 for the visible-bounds half-size, which already gave headroom. With the offset now placing the box's center at the canvas center instead of at one edge, the box fits the canvas more tightly, which is still correct.

World-space placement (i.e. how the entity is spawned and how the painting ends up positioned relative to world blocks) is unchanged by this spec. The model is described in entity-local coordinates; any adjustment to placement logic, if needed, is out of scope here.

## Test strategy

Unit tests cover geometry origin and hitbox pivot. No new integration tests are needed; the change is purely geometric. Manual verification in Minecraft:

1. Summon a 1×1 painting in a flat world: the painting front should occupy the block the entity sits in, with the front face flush against the player.
2. Summon a 2×1 painting (W=32, H=16): the painting should extend from the entity's block into the block to the player's left (+X side). The entity itself should remain in the right-hand block of the pair.
3. Summon a 2×2 painting (W=32, H=32): bottom-left block of the painting equals the entity's block; the painting fills the 2×2 region above and to the player's left.
4. Rotate the entity 90°: the painting should rotate around the bottom-left corner (the entity's own block), not around its own center.

## Open questions

None.

// Shared client-side animation + animation controller that rotate the painting
// model based on the entity's minecraft:mark_variant. Server-side, the script
// triggers an event that adds either flat_orient_floor or flat_orient_ceiling,
// each carrying a different mark_variant value:
//   variant 1 -> floor   (root rotated +90deg on X)
//   variant 2 -> ceiling (root rotated -90deg on X)
//   variant 0 -> wall    (no rotation, the default)
//
// The render side never reads component groups directly, so mark_variant is
// the bridge: the server flips it via the event, the client reads it through
// Molang `q.mark_variant` in the controller's transitions.

export const ORIENT_ANIMATION_FILE = 'painting_orient';
export const ORIENT_ANIMATION_FLOOR_ID = 'animation.painting_orient.floor';
export const ORIENT_ANIMATION_CEILING_ID = 'animation.painting_orient.ceiling';
export const ORIENT_CONTROLLER_ID = 'controller.animation.painting_orient';
export const ORIENT_ANIMATION_YAW_ID = 'animation.painting_orient.yaw';
// Parent bone of `root` (see geometry.ts) that carries the cardinal yaw, so
// the floor/ceiling pitch on `root` is applied first and the yaw after it.
export const ORIENT_YAW_BONE = 'orient_yaw';
// Sign of the Bedrock bone Y rotation relative to entity yaw. Bedrock's own
// look_at_target feeds q.target_y_rotation straight into head rotation Y,
// i.e. +a on bone Y turns the model like +a of entity yaw (+Z -> -X).
// Calibration knob: if east/west walls render on the wrong side in-game,
// flip this to -1 AND swap the (x, z) step in entity.ts rotateHitboxesAroundY.
export const YAW_ANIMATION_SIGN = 1;

// Short names registered in client_entity.description.animations. The
// controller is the one referenced in scripts.animate; the two animations
// are pulled in by the controller's "animations" list inside each state.
export const ORIENT_FLOOR_SHORTNAME = 'orient_floor';
export const ORIENT_CEILING_SHORTNAME = 'orient_ceiling';
export const ORIENT_CONTROLLER_SHORTNAME = 'orient';
export const ORIENT_YAW_SHORTNAME = 'orient_yaw';

export function buildOrientAnimations() {
  // Rotation signs in Bedrock pitch the model so that the painting's front
  // (north face of the geometry, the -Z direction in entity-local space)
  // ends up facing the correct world direction:
  //   floor   -> front faces +Y (up)    -> rotation [-90, 0, 0]
  //   ceiling -> front faces -Y (down)  -> rotation [+90, 0, 0]
  //
  // The translation offsets compensate for the model's pivot landing at
  // the entity's feet: after rotation the geometry would otherwise float
  // away from the clicked face, so each animation nudges root back onto
  // the surface. Values tuned in-game against actual placements.
  return {
    format_version: '1.10.0',
    animations: {
      [ORIENT_ANIMATION_FLOOR_ID]: {
        loop: 'hold_on_last_frame' as const,
        animation_length: 0.05,
        bones: {
          root: {
            rotation: [-90, 0, 0],
            position: [0, 8, -8],
          },
        },
      },
      // Cardinal yaw, always running. The entity itself is kept at yaw 0 by
      // the runtime script so custom_hit_test pivots (whose yaw behaviour is
      // undocumented) never get rotated by the engine; the model is turned
      // here instead, by d * 90 deg where d = (mark_variant % 10) - 1.
      // mark_variant 0 (not yet oriented / legacy v2) -> no extra yaw.
      [ORIENT_ANIMATION_YAW_ID]: {
        loop: true,
        bones: {
          [ORIENT_YAW_BONE]: {
            rotation: [0, `q.mark_variant > 0 ? (math.mod(q.mark_variant, 10) - 1) * ${90 * YAW_ANIMATION_SIGN} : 0`, 0],
          },
        },
      },
      [ORIENT_ANIMATION_CEILING_ID]: {
        loop: 'hold_on_last_frame' as const,
        animation_length: 0.05,
        bones: {
          root: {
            rotation: [90, 0, 0],
            position: [0, 8, 8],
          },
        },
      },
    },
  };
}

export function buildOrientAnimationController() {
  // mark_variant ranges (set server-side in entity.ts):
  //   11..14 = wall  (north / east / south / west) - default state, no
  //            root-bone rotation; the entity yaw rotates the model.
  //   21..24 = floor (north / east / south / west) - run floor animation.
  //   31..34 = ceiling (north / east / south / west) - run ceiling animation.
  // The animations themselves are not per-direction: yaw rotation of the
  // model is handled by entity.setRotation() in the runtime script, so all
  // four floor variants reuse the same root-pitch animation, ditto ceiling.
  return {
    format_version: '1.10.0',
    animation_controllers: {
      [ORIENT_CONTROLLER_ID]: {
        initial_state: 'default',
        states: {
          default: {
            transitions: [
              { floor: 'q.mark_variant >= 21 && q.mark_variant <= 24' },
              { ceiling: 'q.mark_variant >= 31 && q.mark_variant <= 34' },
            ],
          },
          floor: {
            animations: [ORIENT_FLOOR_SHORTNAME],
            transitions: [
              { default: 'q.mark_variant < 21 || q.mark_variant > 24' },
            ],
          },
          ceiling: {
            animations: [ORIENT_CEILING_SHORTNAME],
            transitions: [
              { default: 'q.mark_variant < 31 || q.mark_variant > 34' },
            ],
          },
        },
      },
    },
  };
}

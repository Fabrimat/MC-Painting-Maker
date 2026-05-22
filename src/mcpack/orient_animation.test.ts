import { describe, it, expect } from 'vitest';
import {
  buildOrientAnimations,
  buildOrientAnimationController,
  ORIENT_ANIMATION_FLOOR_ID,
  ORIENT_ANIMATION_CEILING_ID,
  ORIENT_CONTROLLER_ID,
  ORIENT_FLOOR_SHORTNAME,
  ORIENT_CEILING_SHORTNAME,
} from './orient_animation';

describe('buildOrientAnimations', () => {
  it('rotates root -90 on X for floor and translates it onto the floor surface', () => {
    const j = buildOrientAnimations();
    const a = (j.animations as Record<string, { bones: { root: { rotation: number[]; position: number[] } } }>)[ORIENT_ANIMATION_FLOOR_ID];
    expect(a).toBeDefined();
    expect(a.bones.root.rotation).toEqual([-90, 0, 0]);
    // Tuned in-game; values compensate for the pivot landing at the
    // entity's feet so the painting sits flush on the clicked face.
    expect(a.bones.root.position).toEqual([0, 8, -8]);
  });

  it('rotates root +90 on X for ceiling and translates it onto the ceiling surface', () => {
    const j = buildOrientAnimations();
    const a = (j.animations as Record<string, { bones: { root: { rotation: number[]; position: number[] } } }>)[ORIENT_ANIMATION_CEILING_ID];
    expect(a).toBeDefined();
    expect(a.bones.root.rotation).toEqual([90, 0, 0]);
    expect(a.bones.root.position).toEqual([0, 8, 8]);
  });

  it('uses hold_on_last_frame so the rotation persists once the (tiny) animation ends', () => {
    const j = buildOrientAnimations();
    const a = (j.animations as Record<string, { loop: string }>)[ORIENT_ANIMATION_FLOOR_ID];
    expect(a.loop).toBe('hold_on_last_frame');
  });
});

describe('buildOrientAnimationController', () => {
  it('routes mark_variant 21..24 to the floor state and 31..34 to the ceiling state', () => {
    const j = buildOrientAnimationController();
    const states = (j.animation_controllers as any)[ORIENT_CONTROLLER_ID].states as Record<string, {
      transitions?: Array<Record<string, string>>;
      animations?: string[];
    }>;
    // Per-surface contiguous integer ranges (tens digit = surface) so the
    // 4 per-cardinal mark_variant values all land in the same state.
    expect(states.default.transitions).toContainEqual({ floor: 'q.mark_variant >= 21 && q.mark_variant <= 24' });
    expect(states.default.transitions).toContainEqual({ ceiling: 'q.mark_variant >= 31 && q.mark_variant <= 34' });
    expect(states.floor.animations).toContain(ORIENT_FLOOR_SHORTNAME);
    expect(states.ceiling.animations).toContain(ORIENT_CEILING_SHORTNAME);
  });

  it('transitions back to default when mark_variant leaves the active range', () => {
    const j = buildOrientAnimationController();
    const states = (j.animation_controllers as any)[ORIENT_CONTROLLER_ID].states as Record<string, {
      transitions?: Array<Record<string, string>>;
    }>;
    expect(states.floor.transitions).toContainEqual({ default: 'q.mark_variant < 21 || q.mark_variant > 24' });
    expect(states.ceiling.transitions).toContainEqual({ default: 'q.mark_variant < 31 || q.mark_variant > 34' });
  });
});

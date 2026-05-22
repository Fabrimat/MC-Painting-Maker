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
  it('rotates root -90 on X for floor so the painting front ends up facing up', () => {
    const j = buildOrientAnimations();
    const a = (j.animations as Record<string, { bones: { root: { rotation: number[] } } }>)[ORIENT_ANIMATION_FLOOR_ID];
    expect(a).toBeDefined();
    expect(a.bones.root.rotation).toEqual([-90, 0, 0]);
  });

  it('rotates root +90 on X for ceiling so the painting front ends up facing down', () => {
    const j = buildOrientAnimations();
    const a = (j.animations as Record<string, { bones: { root: { rotation: number[] } } }>)[ORIENT_ANIMATION_CEILING_ID];
    expect(a).toBeDefined();
    expect(a.bones.root.rotation).toEqual([90, 0, 0]);
  });

  it('uses hold_on_last_frame so the rotation persists once the (tiny) animation ends', () => {
    const j = buildOrientAnimations();
    const a = (j.animations as Record<string, { loop: string }>)[ORIENT_ANIMATION_FLOOR_ID];
    expect(a.loop).toBe('hold_on_last_frame');
  });
});

describe('buildOrientAnimationController', () => {
  it('routes mark_variant 1 to the floor state and 2 to the ceiling state', () => {
    const j = buildOrientAnimationController();
    const states = (j.animation_controllers as any)[ORIENT_CONTROLLER_ID].states as Record<string, {
      transitions?: Array<Record<string, string>>;
      animations?: string[];
    }>;
    expect(states.default.transitions).toContainEqual({ floor: 'q.mark_variant == 1' });
    expect(states.default.transitions).toContainEqual({ ceiling: 'q.mark_variant == 2' });
    expect(states.floor.animations).toContain(ORIENT_FLOOR_SHORTNAME);
    expect(states.ceiling.animations).toContain(ORIENT_CEILING_SHORTNAME);
  });

  it('transitions back to default when mark_variant changes (so removing the component group reverts the rotation)', () => {
    const j = buildOrientAnimationController();
    const states = (j.animation_controllers as any)[ORIENT_CONTROLLER_ID].states as Record<string, {
      transitions?: Array<Record<string, string>>;
    }>;
    expect(states.floor.transitions).toContainEqual({ default: 'q.mark_variant != 1' });
    expect(states.ceiling.transitions).toContainEqual({ default: 'q.mark_variant != 2' });
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_MIST_COLOR, mistOf, readSceneLighting, sceneLook } from '../../src/app/lighting/sceneLightingOptions';
import { MIST_DRIFT_CELLS, MistClock, mistOctaves } from '../../src/app/pixi/lighting/MistClock';
import { DEFAULT_SCENE_LIGHTING } from '../../src/app/types/lightingTypes';

describe('mist over what the players do not see', () => {
  it('is off unless the scene turns it on, and reads every option with its default and within range', () => {
    expect(mistOf(DEFAULT_SCENE_LIGHTING)).toBeNull();
    expect(mistOf({ unexploredMist: true })).toEqual({ density: 0.5, speed: 1, angle: 0, color: DEFAULT_MIST_COLOR });
    expect(mistOf({ unexploredMist: true, unexploredMistDensity: 2, unexploredMistSpeed: -1, unexploredMistAngle: -90, unexploredMistColor: '#112233' }))
      .toEqual({ density: 1, speed: 0, angle: 270, color: '#112233' });
  });

  it('is part of the look the composite draws, and a mist colour that cannot be read is dropped when loaded', () => {
    expect(sceneLook({ ...DEFAULT_SCENE_LIGHTING, unexploredMist: true, unexploredMistDensity: 0.8 }))
      .toEqual({ ambient: DEFAULT_SCENE_LIGHTING.ambient, unexploredMist: true, unexploredMistDensity: 0.8 });
    expect(readSceneLighting({ enabled: true, unexploredMist: true, unexploredMistColor: 'grey' })).toEqual({ ...DEFAULT_SCENE_LIGHTING, enabled: true, unexploredMist: true });
  });

  it('draws as much detail as the quality gives the liquids', () => {
    expect([mistOctaves({ liquidFps: 30 }), mistOctaves({ liquidFps: 15 }), mistOctaves({ liquidFps: 10 })]).toEqual([5, 4, 3]);
  });

  it('churns and drifts by the time that passed, at its speed and the way it is set, without jumping after a hold', () => {
    const clock = new MistClock();
    const mist = { density: 0.5, speed: 2, angle: 180, color: DEFAULT_MIST_COLOR };
    // The drift is wrapped to the loop: a hair below zero reads as a hair below the loop.
    const unwrapped = (value: number): number => (value > 7200 ? value - 4 * 60 * 60 : value);
    expect(clock.advance(1010, mist, 30)).toBe(true);
    expect(clock.time).toBe(0);
    // Within the same frame slot of the animation clock nothing moves.
    expect(clock.advance(1020, mist, 30)).toBe(false);
    expect(clock.advance(1110, mist, 30)).toBe(true);
    expect(clock.time).toBeCloseTo(0.2, 6);
    // Drifting left on the map (180°) moves the noise beneath it right.
    expect(unwrapped(clock.drift.x)).toBeCloseTo(MIST_DRIFT_CELLS * 0.2, 6);
    expect(unwrapped(clock.drift.y)).toBeCloseTo(0, 6);
    clock.hold();
    expect(clock.advance(60_000, mist, 30)).toBe(true);
    expect(clock.time).toBeCloseTo(0.2, 6);
  });
});

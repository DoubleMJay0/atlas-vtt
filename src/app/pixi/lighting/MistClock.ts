import type { LightingQuality } from '../../lighting/lightingQuality';
import type { Mist } from '../../lighting/sceneLightingOptions';
import { animationFrameDue, slotsOf } from '../utils/animationFrames';

/** Seconds after which the mist's clock and drift start again: once in four hours a frame may jump. */
export const MIST_LOOP_SECONDS = 4 * 60 * 60;
/** Cells a second the mist drifts at its own pace (speed 1): a slow creep. */
export const MIST_DRIFT_CELLS = 0.12;
/** The longest step the clock takes between two frames: a stalled window resumes where it was. */
const MAX_STEP_MS = 100;

/** How much detail the mist is drawn with at a quality: as the liquids, by the frames a second it gives them (30 / 15 / 10). */
export function mistOctaves(quality: Pick<LightingQuality, 'liquidFps'>): number {
  if (quality.liquidFps >= 30) return 5;
  return quality.liquidFps >= 15 ? 4 : 3;
}

const wrap = (value: number, period: number): number => value - Math.floor(value / period) * period;

/**
 * How far the mist has churned and drifted. It moves on only while it plays (`advance` each tick),
 * at most `fps` frames a second on the map's animation clock (`animationFrameDue`), so its frames
 * share their renders with the liquids' and the flickering lights'. Speed changes never make it jump:
 * the clock adds up the steps, each at the speed of its own frame.
 */
export class MistClock {
  private last: number | null = null;
  private seconds = 0;
  private readonly offset = { x: 0, y: 0 };

  /** Moves the mist on to `now` (ms) if a frame is due; true when it moved, so a render is wanted. */
  advance(now: number, mist: Mist, fps: number): boolean {
    if (fps <= 0 || !animationFrameDue(now, this.last, slotsOf(1000 / fps))) return false;
    const step = this.last === null ? 0 : Math.min(Math.max(now - this.last, 0), MAX_STEP_MS) / 1000;
    this.last = now;
    const pace = step * mist.speed;
    const angle = (mist.angle * Math.PI) / 180;
    this.seconds = wrap(this.seconds + pace, MIST_LOOP_SECONDS);
    // The noise lies under the world: drifting the mist one way moves the noise the other.
    this.offset.x = wrap(this.offset.x - Math.cos(angle) * MIST_DRIFT_CELLS * pace, MIST_LOOP_SECONDS);
    this.offset.y = wrap(this.offset.y - Math.sin(angle) * MIST_DRIFT_CELLS * pace, MIST_LOOP_SECONDS);
    return true;
  }

  /** It held still (paused, unlit): the next frame starts from there without a jump. */
  hold(): void {
    this.last = null;
  }

  get time(): number {
    return this.seconds;
  }

  get drift(): { x: number; y: number } {
    return this.offset;
  }
}

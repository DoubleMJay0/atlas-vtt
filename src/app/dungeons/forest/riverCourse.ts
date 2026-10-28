import type { CellPoint } from '../model';
import type { Rng } from '../rng';

/**
 * A river's middle line as rivers lie on the ground. Its heading swings as a sine-generated curve
 * (Langbein and Leopold: the direction, not the position, follows a sine of the distance along
 * the channel), the shape real meanders take, while it steers for the places it must pass. A bend
 * comes back every `BEND_WIDTHS` widths along the channel (about eleven widths down the valley at
 * the swing used here) and never turns tighter than `TIGHTEST_RADIUS` widths, the bends of real
 * rivers lying at two to three; so its banks, half a width out, never fold over each other.
 */

type Vec = CellPoint;

/** The distance along the channel from one bend to the next of the same side and back, in widths. */
const BEND_WIDTHS = 15;
/** The tightest a bend may turn, as its radius in widths. */
const TIGHTEST_RADIUS = 1.6;
/** The spacing of the line's points, in cells. */
export const COURSE_STEP = 0.25;
/** How fast the heading turns towards where it should go, per step. */
const STEER = 0.22;

/** How a river winds: its width and the swing of its heading, in radians at a bend's crossing (0 is straight; real meanders swing 1 to 1.7). */
export interface Winding {
  width: number;
  swing: number;
}

/**
 * The line from `ways[0]` through every way to the last, `start` the heading it leaves with
 * (radians; unset, towards the next way). A way counts as reached within `REACHED` cells.
 */
export function riverCourse(ways: readonly Vec[], winding: Winding, rng: Rng, start?: number): Vec[] {
  const { width, swing } = winding;
  const wavelength = BEND_WIDTHS * Math.max(width, 0.8);
  const tightest = 1 / (TIGHTEST_RADIUS * Math.max(width, 0.6));
  const phase = rng() * Math.PI * 2;
  // Bends are never quite alike: each half wave swings a little more or less.
  const swings = Array.from({ length: 64 }, () => swing * (0.75 + rng() * 0.5));
  let p = { ...ways[0]! };
  let heading = start ?? Math.atan2(ways[1]!.y - p.y, ways[1]!.x - p.x);
  let next = 1;
  let s = 0;
  const line: Vec[] = [p];
  const limit = 20 * ways.reduce((sum, w, i) => sum + (i ? Math.hypot(w.x - ways[i - 1]!.x, w.y - ways[i - 1]!.y) : 0), 0) / COURSE_STEP;
  while (next < ways.length && line.length < limit) {
    const target = ways[next]!;
    const toward = Math.atan2(target.y - p.y, target.x - p.x);
    const wave = (s / wavelength) * Math.PI * 2 + phase;
    const half = swings[Math.floor(wave / Math.PI) & 63]!;
    // The swing fades near a way it must reach, so it reaches it rather than circling it.
    const near = Math.min(1, Math.hypot(target.x - p.x, target.y - p.y) / (wavelength * 0.35));
    const wanted = toward + Math.sin(wave) * half * near;
    const turn = Math.max(-tightest * COURSE_STEP, Math.min(tightest * COURSE_STEP, wrapped(wanted - heading) * STEER));
    heading += turn;
    p = { x: p.x + Math.cos(heading) * COURSE_STEP, y: p.y + Math.sin(heading) * COURSE_STEP };
    s += COURSE_STEP;
    line.push(p);
    if (Math.hypot(target.x - p.x, target.y - p.y) < REACHED) next += 1;
  }
  return line;
}

/** A way counts as reached this near, in cells. */
const REACHED = 1;

function wrapped(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * A house's windows (`DungeonFloor.windows`), drawn once through a hand: the outer wall stops over
 * the window's span (`clipOutsideMouths`), and in its thickness stands a manor window as the plan
 * cuts it. Its reveals close the wall at both ends; a stone sill runs out past the outer face, a
 * timber window board lies on the inner one, and in the middle of the wall stands the frame, its
 * lights of glass divided by stone mullions and each light by a glazing bar. A window of any length
 * along its wall takes as many lights as fit.
 */

import type { DungeonWindow } from '../../model';
import { OUTER_WALL, windowSpan } from '../houseShapes';
import type { Vec } from '../geometry';
import type { VisibleFloor } from '../visibleDungeon';
import type { Hand } from './hand';
import { polyPath } from './paths';

/** The windows of the rooms a view shows. */
export function shownWindows(dungeon: Pick<VisibleFloor, 'floor' | 'rooms'>): DungeonWindow[] {
  const windows = dungeon.floor.windows ?? [];
  if (windows.length === 0) return windows;
  const shown = new Set(dungeon.rooms.map((room) => room.id));
  return windows.filter((window) => shown.has(window.room));
}

/** Across the wall from its middle (+ outwards), in cells. */
const SILL = { inner: OUTER_WALL / 2 - 0.08, outer: OUTER_WALL / 2 + 0.05, overhang: 0.05 };
const BOARD = 0.045;
const FRAME = 0.05;
const MULLION = 0.022;
/** A light is about this wide; a window has at least two. */
const LIGHT = 0.32;

export function drawWindows(hand: Hand): void {
  for (const window of shownWindows(hand.scene.env.dungeon)) drawWindow(hand, window);
}

/** One window in its own frame: `u` along its span from one reveal, `v` across the wall, outwards. */
function drawWindow(hand: Hand, window: DungeonWindow): void {
  const [a, b] = windowSpan(window);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const { dir } = window;
  const at = (u: number, v: number): Vec => ({ x: a.x + t.x * u + dir.x * v, y: a.y + t.y * u + dir.y * v });
  const quad = (u0: number, v0: number, u1: number, v1: number): Vec[] => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
  const half = OUTER_WALL / 2;
  // The embrasure's floor of stone, then the board inside and the sill outside, standing on it.
  hand.surface(polyPath(quad(0, -half, len, half)), 'stone');
  const board = quad(0, -half, len, -half + BOARD);
  hand.surface(polyPath(board), 'wood');
  hand.line([board], 'fine', true);
  const sill = quad(-SILL.overhang, SILL.inner, len + SILL.overhang, SILL.outer);
  hand.surface(polyPath(sill), 'dressed');
  hand.line([[at(-SILL.overhang, half), at(len + SILL.overhang, half)]], 'fine');
  hand.edges(sill, true);
  // The frame: glass between two rails, its lights divided by mullions and glazing bars.
  const frame = quad(0, -FRAME, len, FRAME);
  hand.surface(polyPath(frame), 'glass');
  const lights = Math.max(2, Math.round(len / LIGHT));
  const width = len / lights;
  hand.line([[at(0, -FRAME), at(len, -FRAME)], [at(0, FRAME), at(len, FRAME)], ...Array.from({ length: lights }, (_, k) => [at((k + 0.5) * width, -FRAME), at((k + 0.5) * width, FRAME)])], 'fine');
  for (let k = 1; k < lights; k++) {
    const mullion = quad(k * width - MULLION, -FRAME, k * width + MULLION, FRAME);
    hand.surface(polyPath(mullion), 'dressed');
    hand.edges(mullion, true);
  }
  // The reveals: the wall's cut faces at both ends.
  hand.line([[at(0, -half), at(0, half)], [at(len, -half), at(len, half)]], 'outline');
}

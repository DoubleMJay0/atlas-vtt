/**
 * Where furniture of whole cells stands in a room: against a wall (its back, or a bed's head),
 * before the back wall, in the middle, in a corner, in rows, or hung on a wall run no door
 * breaks. Each tries the places in turn through `FurnishSpace`; a verb that finds no place adds
 * nothing. A round room has no straight wall, so the wall verbs place nothing there. Disc verbs
 * of the rooms furnished by role are in `arrange.ts`.
 */

import { cellKey, dir } from '../geometry';
import type { CellDir, CellPoint, DungeonProp, PropKind } from '../model';
import { shuffled } from '../rng';
import type { WallSide } from '../terrain/roomCells';
import { PROP_SPECS, isCellPiece, propReach } from './catalogue';
import { type FurnishSpace, hangPiece, placeDisc, placePiece } from './furnishSpace';
import { facing } from './roomFrame';

/** The cells of a piece `along` × `out` standing at the run of wall cells from `start` along `alongDir`, its front towards `into`. */
export function footprintAt(start: CellPoint, alongDir: CellDir, into: CellDir, along: number, out: number): CellPoint[] {
  const cells: CellPoint[] = [];
  for (let a = 0; a < along; a++) for (let o = 0; o < out; o++) cells.push({ x: start.x + alongDir.x * a + into.x * o, y: start.y + alongDir.y * a + into.y * o });
  return cells;
}

/** Runs of `length` wall cells of `side` no door breaks, middle first or shuffled. */
export function wallRuns(fs: FurnishSpace, side: WallSide, length: number, middleFirst: boolean): CellPoint[][] {
  const { cells: rc } = fs;
  if (rc.room.rotunda) return [];
  const wall = rc.wallCells(side);
  const keys = new Set(wall.map((c) => cellKey(c.x, c.y)));
  const alongDir = side === 'back' || side === 'near' ? rc.across : rc.axis;
  const runs = wall.flatMap((start) => {
    const run = Array.from({ length }, (_, k) => ({ x: start.x + alongDir.x * k, y: start.y + alongDir.y * k }));
    return run.every((c) => keys.has(cellKey(c.x, c.y)) && !rc.doorOn(side, c)) ? [run] : [];
  });
  if (!middleFirst) return shuffled(fs.rng, runs);
  const mid = (runs.length - 1) / 2;
  return runs.map((run, k) => ({ run, k })).sort((a, b) => Math.abs(a.k - mid) - Math.abs(b.k - mid)).map(({ run }) => run);
}

const opposite = (d: CellDir): CellDir => dir(-d.x, -d.y);

/** A piece against one of `sides` (its back, or its head for a bed), the first place that takes it; a disc stands just before the wall. */
function onSides(fs: FurnishSpace, kind: PropKind, sides: readonly WallSide[], middleFirst: boolean): DungeonProp | null {
  const spec = PROP_SPECS[kind];
  const { cells: rc } = fs;
  const length = isCellPiece(spec) ? spec.footprint.along : 1;
  for (const side of sides) {
    const into = opposite(rc.beyond(side));
    const alongDir = side === 'back' || side === 'near' ? rc.across : rc.axis;
    for (const run of wallRuns(fs, side, length, middleFirst)) {
      const start = run[0] as CellPoint;
      const placed = isCellPiece(spec)
        ? placePiece(fs, kind, footprintAt(start, alongDir, into, spec.footprint.along, spec.footprint.out), into)
        : placeDisc(fs, kind, { x: start.x + 0.5 - into.x * (0.45 - propReach(kind)), y: start.y + 0.5 - into.y * (0.45 - propReach(kind)) }, facing(into));
      if (placed) return placed;
    }
  }
  return null;
}

export function againstWall(fs: FurnishSpace, kind: PropKind, sides: readonly WallSide[]): DungeonProp | null {
  return onSides(fs, kind, sides, false);
}

/** Before the back wall, the middle first. */
export function atBackWall(fs: FurnishSpace, kind: PropKind): DungeonProp | null {
  return onSides(fs, kind, ['back'], true);
}

/** Cells by their distance from the room's middle, nearest first. */
function byCentre(fs: FurnishSpace): CellPoint[] {
  const { cells: rc } = fs;
  const out: CellPoint[] = [];
  for (let i = 0; i < rc.depth; i++) for (let j = 0; j < rc.width; j++) out.push(rc.cell(i, j));
  const { centre } = fs.space.frame;
  return out.sort((a, b) => Math.hypot(a.x + 0.5 - centre.x, a.y + 0.5 - centre.y) - Math.hypot(b.x + 0.5 - centre.x, b.y + 0.5 - centre.y));
}

/** In the room's middle, its long side across the room, facing the way in. */
export function atCentre(fs: FurnishSpace, kind: PropKind): DungeonProp | null {
  const spec = PROP_SPECS[kind];
  const { cells: rc } = fs;
  const into = opposite(rc.axis);
  for (const c of byCentre(fs).slice(0, 9)) {
    const placed = isCellPiece(spec)
      ? placePiece(fs, kind, footprintAt(c, rc.across, into, spec.footprint.along, spec.footprint.out), into)
      : placeDisc(fs, kind, { x: c.x + 0.5, y: c.y + 0.5 }, facing(into));
    if (placed) return placed;
  }
  return null;
}

/** In a free corner: a cell piece along one of its walls, a disc pushed into the corner. */
export function inCorner(fs: FurnishSpace, kind: PropKind): DungeonProp | null {
  const spec = PROP_SPECS[kind];
  const { cells: rc } = fs;
  if (rc.room.rotunda) return null;
  const corners = shuffled(fs.rng, (['back', 'near'] as const).flatMap((end) => (['left', 'right'] as const).map((side) => [end, side] as const)));
  for (const [end, side] of corners) {
    const sideKeys = new Set(rc.wallCells(side).map((c) => cellKey(c.x, c.y)));
    const corner = rc.wallCells(end).find((c) => sideKeys.has(cellKey(c.x, c.y)));
    if (!corner) continue;
    const into = opposite(rc.beyond(end));
    const inward = opposite(rc.beyond(side));
    const placed = isCellPiece(spec)
      ? placePiece(fs, kind, footprintAt(corner, inward, into, spec.footprint.along, spec.footprint.out), into)
      : placeDisc(fs, kind, { x: corner.x + 0.5 - (into.x + inward.x) * (0.45 - propReach(kind)), y: corner.y + 0.5 - (into.y + inward.y) * (0.45 - propReach(kind)) }, facing(into) + (fs.rng() - 0.5) * 0.4);
    if (placed) return placed;
  }
  return null;
}

/** The column a row of free-standing pieces runs down: the middle first, then out to both sides, a ring's width apart. */
function rowColumns(width: number): number[] {
  const middle = Math.floor((width - 1) / 2);
  const out = [middle];
  for (let step = 3; middle - step >= 1 || middle + step <= width - 2; step += 3) out.push(middle - step, middle + step);
  return out.filter((j) => j >= 1 && j <= width - 2);
}

/**
 * `count` of a piece in rows: against the side walls for one that backs onto a wall or sleeps
 * head to it (bunks, stalls), down the room's length for a free one (a long table, drawn as long
 * as its stretch and the room allow), a disc in ranks down the room.
 */
export function inRows(fs: FurnishSpace, kind: PropKind, count: number): DungeonProp[] {
  const spec = PROP_SPECS[kind];
  const { cells: rc } = fs;
  const out: DungeonProp[] = [];
  if (isCellPiece(spec) && spec.wall !== 'free') {
    for (let k = 0; k < count; k++) {
      const placed = againstWall(fs, kind, k % 2 === 0 ? ['left', 'right'] : ['right', 'left']);
      if (placed) out.push(placed);
    }
    return out;
  }
  if (isCellPiece(spec)) {
    const length = Math.max(spec.footprint.along, Math.min(spec.stretch ?? spec.footprint.along, rc.depth - 2));
    for (const j of rowColumns(rc.width)) {
      if (out.length >= count) break;
      for (let len = length; len >= spec.footprint.along; len--) {
        const i0 = Math.floor((rc.depth - len) / 2);
        const cells = Array.from({ length: len }, (_, k) => rc.cell(i0 + k, j));
        const placed = placePiece(fs, kind, cells, rc.across, len);
        if (placed) {
          out.push(placed);
          break;
        }
      }
    }
    return out;
  }
  const step = Math.max(1, (rc.depth - 1) / Math.max(1, count));
  for (let k = 0; k < count; k++) {
    const i = Math.min(rc.depth - 1, Math.floor(0.5 + step * (k + 0.5)));
    for (const j of rowColumns(rc.width)) {
      const c = rc.cell(i, j);
      const placed = placeDisc(fs, kind, { x: c.x + 0.5, y: c.y + 0.5 }, facing(dir(-rc.axis.x, -rc.axis.y)));
      if (placed) {
        out.push(placed);
        break;
      }
    }
  }
  return out;
}

/**
 * `count` of a wall piece on wall runs no door breaks: an outer one only on the outer sides, one
 * strung across the room once, wall to wall at its middle.
 */
export function onWall(fs: FurnishSpace, kind: PropKind, count: number): DungeonProp[] {
  const spec = PROP_SPECS[kind];
  const { cells: rc } = fs;
  if (!spec.wallPiece || !isCellPiece(spec) || rc.room.rotunda) return [];
  if (spec.wall === 'across') {
    const i = Math.floor(rc.depth / 2);
    const run = Array.from({ length: rc.width }, (_, j) => rc.cell(i, j));
    const across = hangPiece(fs, kind, run, 'across');
    return across ? [across] : [];
  }
  const sides = spec.wall === 'outer' && fs.outer ? (['back', 'left', 'right', 'near'] as const).filter((side) => fs.outer?.has(side)) : (['back', 'left', 'right', 'near'] as const);
  const runs = sides.flatMap((side) => wallRuns(fs, side, spec.footprint.along, false).map((run) => ({ side, run })));
  const out: DungeonProp[] = [];
  for (const { side, run } of shuffled(fs.rng, runs)) {
    if (out.length >= count) break;
    const placed = hangPiece(fs, kind, run, side);
    if (placed) out.push(placed);
  }
  return out;
}

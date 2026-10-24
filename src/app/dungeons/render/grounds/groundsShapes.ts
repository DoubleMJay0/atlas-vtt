/**
 * The grounds of a house as drawn (`DungeonFloor.grounds`, on its entrance floor): where each piece
 * lies, the drive with its turning circle, the open ground the house's and the garden walls' shadows
 * fall on, and how tall what stands there is, worked out once per floor and shared by both painters.
 */

import { cellKey } from '../../geometry';
import type { DungeonFloor, GroundsKind, GroundsPiece, HouseGrounds } from '../../model';
import type { Stand } from '../art/heights';
import { polysPath, rectPoly, type PathFn } from '../art/paths';
import { subtractRings, unionRings } from '../clipShapes';
import { cellsShapes, type Vec } from '../geometry';
import { houseMass } from '../house/houseMass';

/** How tall each standing piece of the grounds is, a house's wall being 1. */
export const GROUNDS_HEIGHT = { hedge: 0.75, boundary: 0.7, pier: 0.95, outbuilding: 1, greenhouse: 0.45, fountain: 0.25 } as const;

/** The ring a drive sweeps round its fountain: from the island's edge out to the turn's outer edge, in cells from its middle. */
export const SWEEP = { inner: 1.02, outer: 2.96 };

/** An outbuilding's walls: masonry this thick inside the cells it stands on (a greenhouse's low base wall thinner). */
export const OUTBUILDING_WALL = { solid: 0.26, greenhouse: 0.12 };

export interface GroundsLayout {
  grounds: HouseGrounds;
  /** The pieces of each kind, in the model's order. */
  pieces: ReadonlyMap<GroundsKind, readonly GroundsPiece[]>;
  /** The lot's outline. */
  lot: Vec[];
  /** The open ground: the lot without the house, as rings. */
  open: Vec[][];
  /** The drive and paths, as rings: their cells, a drive's turn round its fountain rounded. */
  ways: Vec[][];
  /** The fountain a drive turns round, if any: its middle. */
  sweep: Vec | null;
}

const layouts = new WeakMap<DungeonFloor, GroundsLayout | null>();

/** A floor's grounds as drawn, worked out once; null where the floor has none or their lawn is not drawn. */
export function groundsLayout(floor: DungeonFloor): GroundsLayout | null {
  if (layouts.has(floor)) return layouts.get(floor)!;
  const grounds = floor.grounds;
  const layout = grounds?.pieces.some((piece) => piece.kind === 'garden') ? build(floor, grounds) : null;
  layouts.set(floor, layout);
  return layout;
}

function build(floor: DungeonFloor, grounds: HouseGrounds): GroundsLayout {
  const pieces = new Map<GroundsKind, GroundsPiece[]>();
  for (const piece of grounds.pieces) pieces.set(piece.kind, [...(pieces.get(piece.kind) ?? []), piece]);
  const fountain = pieces.get('garden-fountain')?.[0];
  const sweep = fountain?.at ?? null;
  const lot = rectPoly(grounds.lot);
  return { grounds, pieces, lot, open: subtractRings([lot], houseMass(floor)?.outline ?? []), ways: wayRings(pieces, sweep), sweep };
}

export function piecesOf(layout: GroundsLayout, kind: GroundsKind): readonly GroundsPiece[] {
  return layout.pieces.get(kind) ?? [];
}

/** A circle as a polygon of `n` corners. */
export function circlePoly(c: Vec, r: number, n = 64): Vec[] {
  return Array.from({ length: n }, (_, k) => ({ x: c.x + Math.cos((k / n) * Math.PI * 2) * r, y: c.y + Math.sin((k / n) * Math.PI * 2) * r }));
}

/** The drive's and paths' ground, with the gates' cells the way runs through: where a drive turns round a fountain, a ring instead of the square of cells. */
function wayRings(pieces: ReadonlyMap<GroundsKind, readonly GroundsPiece[]>, sweep: Vec | null): Vec[][] {
  const turn = (c: Vec): boolean => sweep !== null && Math.abs(c.x + 0.5 - sweep.x) < 3 && Math.abs(c.y + 0.5 - sweep.y) < 3;
  const cells = (['path', 'drive', 'gate'] as const).flatMap((kind) => (pieces.get(kind) ?? []).flatMap((piece) => piece.cells)).filter((c) => !turn(c));
  const rings = cells.length ? cellsShapes(cells).flatMap((shape) => shape.rings) : [];
  if (!sweep) return rings;
  return subtractRings(unionRings([...rings, circlePoly(sweep, SWEEP.outer)]), [circlePoly(sweep, SWEEP.inner)]);
}

/** The open ground round the house, where shadows fall as on a floor: the lot without the house. */
export function openGround(floor: DungeonFloor): PathFn | null {
  const layout = groundsLayout(floor);
  return layout && polysPath(layout.open);
}

/** What stands on the grounds, for the scene's shadows and occlusion. */
export function groundsStands(floor: DungeonFloor): Stand[] {
  const layout = groundsLayout(floor);
  if (!layout) return [];
  const cellsPath = (pieces: readonly GroundsPiece[]): PathFn => polysPath(pieces.flatMap((piece) => cellsShapes(piece.cells).flatMap((shape) => shape.rings)));
  const stands: Stand[] = [
    { height: GROUNDS_HEIGHT.hedge, path: cellsPath(piecesOf(layout, 'hedge')) },
    { height: GROUNDS_HEIGHT.boundary, path: cellsPath(piecesOf(layout, 'boundary-wall')) },
  ];
  for (const piece of piecesOf(layout, 'outbuilding')) {
    const glass = piece.use === 'greenhouse';
    stands.push({ height: glass ? GROUNDS_HEIGHT.greenhouse : GROUNDS_HEIGHT.outbuilding, path: polysPath(outbuildingWalls(piece)) });
  }
  return stands;
}

/** The box of cells a piece stands on. */
export function boxOf(cells: readonly Vec[]): { x: number; y: number; w: number; h: number } {
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) + 1 - x, h: Math.max(...ys) + 1 - y };
}

/** An outbuilding's door: the gap in its wall, across the wall's thickness, a cell wide. */
export function outbuildingDoor(piece: GroundsPiece, wall: number): { gap: Vec[]; mid: Vec; inward: Vec } | null {
  const { door } = piece;
  if (!door) return null;
  // The door's outside cell and the way in: the edge it stands on lies between it and the building.
  const mid = { x: door.x + 0.5 + door.dir.x * 0.5, y: door.y + 0.5 + door.dir.y * 0.5 };
  const across = { x: -door.dir.y, y: door.dir.x };
  const half = 0.36;
  const corner = (s: number, d: number): Vec => ({ x: mid.x + across.x * half * s + door.dir.x * d, y: mid.y + across.y * half * s + door.dir.y * d });
  return { gap: [corner(-1, -0.02), corner(1, -0.02), corner(1, wall + 0.02), corner(-1, wall + 0.02)], mid, inward: door.dir };
}

/** An outbuilding's walls as rings: its box less its inside and its doorway. */
export function outbuildingWalls(piece: GroundsPiece): Vec[][] {
  const wall = piece.use === 'greenhouse' ? OUTBUILDING_WALL.greenhouse : OUTBUILDING_WALL.solid;
  const box = boxOf(piece.cells);
  const inside = rectPoly({ x: box.x + wall, y: box.y + wall, w: box.w - wall * 2, h: box.h - wall * 2 });
  const door = outbuildingDoor(piece, wall);
  return subtractRings([rectPoly(box)], door ? [inside, door.gap] : [inside]);
}

/** Whether a cell is one of a set's, by key. */
export function cellSet(cells: readonly Vec[]): (x: number, y: number) => boolean {
  const keys = new Set(cells.map((c) => cellKey(c.x, c.y)));
  return (x, y) => keys.has(cellKey(x, y));
}

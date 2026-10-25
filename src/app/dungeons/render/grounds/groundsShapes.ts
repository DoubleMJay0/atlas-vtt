/**
 * The grounds of a house as drawn (`DungeonFloor.grounds`, on its entrance floor): where each piece
 * lies, the drive with its turning circle, the open ground the house's and the garden walls' shadows
 * fall on, each tree's crown and each outbuilding's walls, and how tall what stands there is, worked
 * out once per floor and shared by both painters.
 */

import { cellsBox } from '../../geometry';
import type { DungeonFloor, GroundsKind, GroundsPiece, HouseGrounds } from '../../model';
import type { Stand } from '../art/heights';
import { polysPath, rectPoly, type PathFn } from '../art/paths';
import { subtractRings, unionRings } from '../clipShapes';
import { cellsRings, type Vec } from '../geometry';
import { houseMass } from '../house/houseMass';
import { circle } from '../terrain/cover';
import { crownOf, type Crown } from './crowns';

/** How tall each standing piece of the grounds is, a house's wall being 1. */
export const GROUNDS_HEIGHT = { hedge: 0.75, boundary: 0.7, outbuilding: 1, greenhouse: 0.45 } as const;

/** The ring a drive sweeps round its fountain: from the island's edge out to the turn's outer edge, in cells from its middle. */
export const SWEEP = { inner: 1.02, outer: 2.96 };

/** An outbuilding's walls: masonry this thick inside the cells it stands on (a greenhouse's low base wall thinner). */
const OUTBUILDING_WALL = { solid: 0.26, greenhouse: 0.12 };

type Box = { x: number; y: number; w: number; h: number };

/** An outbuilding: its cells' box, its walls' thickness, the room inside them, its walls as rings and its doorway. */
export interface Outbuilding {
  box: Box;
  wall: number;
  inside: Box;
  walls: Vec[][];
  door: OutbuildingDoor | null;
}

/** An outbuilding's door: the gap in its wall a cell wide, and the door's frame (`u` across the gap, `v` inwards from the outer face). */
export interface OutbuildingDoor {
  gap: Vec[];
  mid: Vec;
  across: Vec;
  inward: Vec;
}

export interface GroundsLayout {
  /** The lot, as a box of cells and as an outline. */
  lotBox: Box;
  lot: Vec[];
  /** The pieces of each kind, in the model's order. */
  pieces: ReadonlyMap<GroundsKind, readonly GroundsPiece[]>;
  /** The open ground: the lot without the house, as rings. */
  open: Vec[][];
  /** The cells of the lawn and of the ways, for what is scattered over them. */
  lawnCells: readonly Vec[];
  wayCells: readonly Vec[];
  /** The drive and paths, as rings: their cells, a drive's turn round its fountain rounded. */
  ways: Vec[][];
  crowns: ReadonlyMap<GroundsPiece, Crown>;
  outbuildings: ReadonlyMap<GroundsPiece, Outbuilding>;
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
  const of = (kind: GroundsKind): readonly GroundsPiece[] => pieces.get(kind) ?? [];
  const lot = rectPoly(grounds.lot);
  const wayCells = (['path', 'drive', 'gate'] as const).flatMap((kind) => of(kind).flatMap((piece) => piece.cells));
  return {
    lotBox: grounds.lot,
    lot,
    pieces,
    open: subtractRings([lot], houseMass(floor)?.outline ?? []),
    lawnCells: of('garden').flatMap((piece) => piece.cells),
    wayCells,
    ways: wayRings(wayCells, of('garden-fountain')[0]?.at ?? null),
    crowns: new Map(of('tree').flatMap((tree) => (tree.at ? [[tree, crownOf(tree.at, tree.radius ?? 1)] as const] : []))),
    outbuildings: new Map(of('outbuilding').map((piece) => [piece, outbuildingOf(piece)] as const)),
  };
}

export function piecesOf(layout: GroundsLayout, kind: GroundsKind): readonly GroundsPiece[] {
  return layout.pieces.get(kind) ?? [];
}

/** The ways' ground as one set of rings: their cells, and where a drive turns round a fountain, a ring instead of the square of cells. */
function wayRings(cells: readonly Vec[], sweep: Vec | null): Vec[][] {
  const turn = (c: Vec): boolean => sweep !== null && Math.abs(c.x + 0.5 - sweep.x) < 3 && Math.abs(c.y + 0.5 - sweep.y) < 3;
  const rings = unionRings(cellsRings(cells.filter((c) => !turn(c))));
  if (!sweep) return rings;
  return subtractRings(unionRings([...rings, circle(sweep, SWEEP.outer, 64)]), [circle(sweep, SWEEP.inner, 64)]);
}

export function outbuildingOf(piece: GroundsPiece): Outbuilding {
  const wall = piece.use === 'greenhouse' ? OUTBUILDING_WALL.greenhouse : OUTBUILDING_WALL.solid;
  const box = cellsBox(piece.cells);
  const inside = { x: box.x + wall, y: box.y + wall, w: box.w - wall * 2, h: box.h - wall * 2 };
  const door = piece.door ? doorOf(piece.door, wall) : null;
  return { box, wall, inside, door, walls: subtractRings([rectPoly(box)], door ? [rectPoly(inside), door.gap] : [rectPoly(inside)]) };
}

/** The doorway on the edge between the door's outside cell and the building, across the whole wall. */
function doorOf(door: NonNullable<GroundsPiece['door']>, wall: number): OutbuildingDoor {
  const mid = { x: door.x + 0.5 + door.dir.x * 0.5, y: door.y + 0.5 + door.dir.y * 0.5 };
  const across = { x: -door.dir.y, y: door.dir.x };
  const corner = (s: number, d: number): Vec => ({ x: mid.x + across.x * 0.36 * s + door.dir.x * d, y: mid.y + across.y * 0.36 * s + door.dir.y * d });
  return { gap: [corner(-1, -0.02), corner(1, -0.02), corner(1, wall + 0.02), corner(-1, wall + 0.02)], mid, across, inward: door.dir };
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
  const cellsPath = (kind: GroundsKind): PathFn => polysPath(piecesOf(layout, kind).flatMap((piece) => cellsRings(piece.cells)));
  return [
    { height: GROUNDS_HEIGHT.hedge, path: cellsPath('hedge') },
    { height: GROUNDS_HEIGHT.boundary, path: cellsPath('boundary-wall') },
    ...[...layout.outbuildings].map(([piece, building]) => ({ height: piece.use === 'greenhouse' ? GROUNDS_HEIGHT.greenhouse : GROUNDS_HEIGHT.outbuilding, path: polysPath(building.walls) })),
  ];
}

import type { WallSegment } from '../../types/wallTypes';
import type { DoorKind, DungeonDoor, DungeonModel } from '../model';
import { visibleDungeon } from '../render/visibleDungeon';
import { REFERENCE_CELL_PX, type DungeonStyle, type DungeonView } from '../style';
import { STEPS, doorEnds, doorLine, splitRings, wallRings, type RingHit } from './wallOutline';

/** Where a dungeon map lies in the world: its pixel (0, 0) is the corner of `originCell`. */
export interface DungeonPlacement {
  originCell: { x: number; y: number };
  pxPerCell: number;
}

/** What stands in a door cell: a door of a kind, or nothing (the passage is open). */
interface DoorWall {
  type: 'door' | 'secret-door';
  locked: boolean;
  /** Where the door lies along the passage, from the cell's middle towards the child room, in cells. */
  v: (door: DungeonDoor, half: number) => number;
}

const middle = (): number => 0;

/**
 * Door kinds as walls. A portcullis is an opening: Atlas has no wall that stops movement alone,
 * and its bars stay drawn. A secret door closes the passage at its parent's wall, where the map
 * shows that wall unbroken; a barricade lies where its leaf is drawn.
 */
const DOOR_WALLS: Partial<Record<DoorKind, DoorWall>> = {
  door: { type: 'door', locked: false, v: middle },
  gate: { type: 'door', locked: true, v: middle },
  barricade: { type: 'door', locked: true, v: () => 0.2 },
  secret: { type: 'secret-door', locked: false, v: (door, half) => (door.from === null ? 0.5 - half : half - 0.5) },
};

/** The drawn wall's width outside the floor, in cells: Stonework walls use the normal stroke. */
export function wallInkWidth(style: DungeonStyle): number {
  const px = style.hatching.mode === 'stonework' ? style.strokes.normal : style.strokes.thick;
  return px / REFERENCE_CELL_PX;
}

export interface DungeonWalls {
  walls: Record<string, WallSegment>;
  /** Doors of each kind that became a door wall. */
  doors: Partial<Record<DoorKind, number>>;
  /** Door kinds whose cell had no walls on both sides to close: left open, for the log. */
  unplaced: number;
}

/**
 * The walls and doors of a dungeon in world pixels, along the centre line of its drawn walls:
 * one chain per wall outline, every wall drawn once (rooms side by side have walls of their own,
 * a cell of rock apart), and every door ending exactly on a corner of the wall beside it, so
 * light and sight find no gap. Rooms the view hides (a secret wing) have no walls. Pure.
 */
export function dungeonWalls(model: DungeonModel, style: DungeonStyle, view: Pick<DungeonView, 'secrets'>, placement: DungeonPlacement): DungeonWalls {
  const { rooms, doors } = visibleDungeon(model, view);
  const half = wallInkWidth(style) / 2;
  const rings = wallRings(rooms, doors, half);

  const placed: { door: DungeonDoor; wall: DoorWall; ends: [RingHit, RingHit] }[] = [];
  let unplaced = 0;
  for (const door of doors) {
    const wall = DOOR_WALLS[door.kind];
    if (!wall) continue;
    // The side walls lie half a cell and half a wall from the door's middle
    const reach = 0.5 + half + 1 / STEPS;
    const ends = doorEnds(rings, doorLine(door, wall.v(door, half)), reach) ?? doorEnds(rings, doorLine(door, 0), reach);
    if (ends) placed.push({ door, wall, ends });
    else unplaced++;
  }

  const outlines = splitRings(rings, placed.flatMap(p => p.ends));
  const { originCell, pxPerCell } = placement;
  const world = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: (p.x - originCell.x) * pxPerCell,
    y: (p.y - originCell.y) * pxPerCell,
  });

  const walls: Record<string, WallSegment> = {};
  let count = 0;
  const add = (from: { x: number; y: number }, to: { x: number; y: number }, rest: Omit<WallSegment, 'id' | 'kind' | 'p1' | 'p2'>): void => {
    if (from.x === to.x && from.y === to.y) return;
    const id = `wall_dungeon_${++count}`;
    walls[id] = { id, kind: 'wall', p1: world(from), p2: world(to), ...rest };
  };

  outlines.forEach((ring, index) => {
    const chainId = `chain_dungeon_${index + 1}`;
    ring.forEach((corner, i) => add(corner, ring[(i + 1) % ring.length]!, { type: 'solid', chainId }));
  });
  const counts: Partial<Record<DoorKind, number>> = {};
  for (const { door, wall, ends } of placed) {
    add(ends[0].point, ends[1].point, { type: wall.type, closed: true, ...(wall.locked && { locked: true }) });
    counts[door.kind] = (counts[door.kind] ?? 0) + 1;
  }
  return { walls, doors: counts, unplaced };
}

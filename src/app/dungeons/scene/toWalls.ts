import type { WallSegment } from '../../types/wallTypes';
import { doorCells, doorMiddle } from '../geometry';
import type { DoorKind, DungeonDoor, DungeonModel } from '../model';
import { visibleFloor } from '../render/visibleDungeon';
import type { DungeonStyle, DungeonView } from '../style';
import { wallInkWidth } from '../render/wallInk';
import type { Vec } from '../render/geometry';
import { OUTER_WALL, mouthDepth } from '../render/houseShapes';
import { shownWindows } from '../render/art/windows';
import { onWindow, secretDoorways, windowCuts } from './houseWalls';
import { STEPS, doorEnds, doorLine, splitRings, wallRings, type RingHit } from './wallOutline';

/** Where a dungeon map lies in the world: its pixel (0, 0) is the corner of `originCell`. */
export interface DungeonPlacement {
  originCell: { x: number; y: number };
  pxPerCell: number;
}

/** What stands in a door cell: a door of a kind, or nothing (an opening or steps). */
interface DoorWall {
  type: 'door' | 'secret-door';
  /** Where the door lies along the passage, from the cell's middle towards the child room, in cells. */
  v: (door: DungeonDoor, half: number) => number;
}

/**
 * Door kinds as walls: a door closed in its cell's middle, where its leaf is drawn; a secret door
 * closing the passage at its parent's wall, where the map shows that wall unbroken. Openings and
 * steps leave the passage open.
 */
const DOOR_WALLS: Partial<Record<DoorKind, DoorWall>> = {
  door: { type: 'door', v: () => 0 },
  secret: { type: 'secret-door', v: (door, half) => (door.from === null ? 0.5 - half : half - 0.5) },
};

/** Doors closed on their own line: a cave's crawl is rock all through and a house's doorway is its wall, so even a secret door closes there. */
const ON_LINE_DOOR_WALLS: Partial<Record<DoorKind, DoorWall>> = { ...DOOR_WALLS, secret: { type: 'secret-door', v: () => 0 } };

/**
 * Whether a point lies on the outer mouth of an entrance: the edge of its cell's wall ring that
 * faces the outside. An entrance leads out, so no wall closes it there (the map draws none either:
 * the ground outside the way in is cleared).
 */
function entranceMouth(door: DungeonDoor, half: number, cave: boolean): (p: Vec) => boolean {
  const cells = doorCells(door);
  // A cave's outline meets its straight mouth at a slant, so the grown corner lies up to a further half wall along it.
  const reach = cells.length / 2 + (cave ? 2 : 1) * half + 1 / STEPS;
  const m = doorMiddle(door);
  const mouth = { x: m.x - door.dir.x * (mouthDepth(door) + half), y: m.y - door.dir.y * (mouthDepth(door) + half) };
  return p => {
    const dx = p.x - mouth.x;
    const dy = p.y - mouth.y;
    return Math.abs(dx * door.dir.x + dy * door.dir.y) < 1 / STEPS && Math.abs(dx * door.dir.y - dy * door.dir.x) <= reach;
  };
}

export interface DungeonWalls {
  walls: Record<string, WallSegment>;
  /** Doors of each kind that became a door wall. */
  doors: Partial<Record<DoorKind, number>>;
  /** Door kinds whose cell had no walls on both sides to close: left open, for the log. */
  unplaced: number;
}

/** Which floor of a scene walls stand on: their ids begin with `id`, and they carry `levels` where the scene has several. */
export interface WallsOf {
  id: string;
  levels?: string[];
}

/**
 * The walls and doors of one floor of a dungeon in world pixels, along the centre line of its drawn walls:
 * one chain per wall outline, every wall drawn once (rooms side by side have walls of their own,
 * a cell of rock apart), and every door ending exactly on a corner of the wall beside it, so
 * light and sight find no gap. Entrances stay open to the outside. Rooms the view hides (a secret
 * wing) have no walls. Pure.
 */
export function dungeonWalls(
  model: DungeonModel,
  style: DungeonStyle,
  view: Pick<DungeonView, 'secrets'>,
  placement: DungeonPlacement,
  floor = 0,
  of: WallsOf = { id: 'dungeon' },
): DungeonWalls {
  const visible = visibleFloor(model, view, floor);
  const { doors, floors, floor: shown } = visible;
  // A door on an edge closes its doorway on the edge itself, whatever its kind.
  const kinds = shown.cave || shown.walls === 'edges' ? ON_LINE_DOOR_WALLS : DOOR_WALLS;
  const half = wallInkWidth(style) / 2;
  const rings = wallRings([...floors, ...secretDoorways(visible)], doors.filter(door => door.kind === 'secret' && !door.edge), half);

  const placed: { door: DungeonDoor; wall: DoorWall; ends: [RingHit, RingHit] }[] = [];
  let unplaced = 0;
  for (const door of doors) {
    const wall = kinds[door.kind];
    if (!wall) continue;
    // The side walls lie half a cell and half a wall from the door's middle
    const reach = (door.edge ? doorCells(door).length / 2 : 0.5) + half + 1 / STEPS;
    const ends = doorEnds(rings, doorLine(door, wall.v(door, half)), reach) ?? doorEnds(rings, doorLine(door, 0), reach);
    if (ends) placed.push({ door, wall, ends });
    else unplaced++;
  }

  // A window cuts the outer wall: between its two cuts stands a wall only a token is stopped by.
  const cuts = shownWindows(visible).flatMap(window => {
    const cut = windowCuts(rings, window, OUTER_WALL / 2 + half);
    return cut ? [cut] : [];
  });
  const glass = onWindow(cuts);
  const outlines = splitRings(rings, [...placed.flatMap(p => p.ends), ...cuts.flat()]);
  const { originCell, pxPerCell } = placement;
  const world = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: (p.x - originCell.x) * pxPerCell,
    y: (p.y - originCell.y) * pxPerCell,
  });

  const walls: Record<string, WallSegment> = {};
  let count = 0;
  const add = (from: { x: number; y: number }, to: { x: number; y: number }, rest: Omit<WallSegment, 'id' | 'kind' | 'p1' | 'p2'>): void => {
    if (from.x === to.x && from.y === to.y) return;
    const id = `wall_${of.id}_${++count}`;
    walls[id] = { id, kind: 'wall', p1: world(from), p2: world(to), ...rest, ...(of.levels && { levels: of.levels }) };
  };

  const mouths = doors.filter(door => door.from === null).map(door => entranceMouth(door, half, shown.cave !== undefined));
  const onMouth = (a: Vec, b: Vec): boolean => mouths.some(mouth => mouth(a) && mouth(b));
  outlines.forEach((ring, index) => {
    const chainId = `chain_${of.id}_${index + 1}`;
    ring.forEach((corner, i) => {
      const next = ring[(i + 1) % ring.length]!;
      if (onMouth(corner, next)) return;
      add(corner, next, { type: 'solid', chainId, ...(glass(corner, next) && { blocks: 'movement' as const }) });
    });
  });
  const counts: Partial<Record<DoorKind, number>> = {};
  for (const { door, wall, ends } of placed) {
    add(ends[0].point, ends[1].point, { type: wall.type, closed: true });
    counts[door.kind] = (counts[door.kind] ?? 0) + 1;
  }
  return { walls, doors: counts, unplaced };
}

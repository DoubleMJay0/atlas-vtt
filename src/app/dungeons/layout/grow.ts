/**
 * Grows the room tree breadth first from the entrance. Every queued room draws from a stream of
 * its own seed, so two rooms queued with one seed grow the same subtree. A layout with too few
 * rooms is thrown away and grown again from another root.
 */

import type { CellDir, CellPoint } from '../model';
import type { DungeonParams } from '../params';
import { type CellRect, dir, rectsClash, rectsTouch } from '../geometry';
import { MAX_SEED, int, pick, stream } from '../rng';
import { type Branch, branchesOf } from './branches';
import { drawDoorKind, drawSize } from './sizes';
import { REGULAR_ZONE, type WorkLayout, type WorkRoom, isNormal, roomAt, roomRect } from './workLayout';

/** Nothing but the first room may cover the way in. */
export const ENTRANCE_BLOCK: CellRect = { x0: -1, y0: -1, x1: 1, y1: 1 };

const AXES: readonly CellDir[] = [dir(0, 1), dir(1, 0), dir(0, -1), dir(-1, 0)];
const MAX_ATTEMPTS = 120;
/** Corridors do not count towards size; this keeps a corridor maze from growing forever. */
const MAX_TOTAL_ROOMS = 400;

interface QueuedRoom {
  parent: number | null;
  origin: CellPoint;
  axis: CellDir;
  flip: boolean;
  seed: number;
  group: number;
  fallbacks: Branch[];
}

/** Whether a room of this shape may stand here: walls may be shared, floors never. */
export function roomFits(layout: WorkLayout, rect: CellRect, ignore: ReadonlySet<number>, first: boolean): boolean {
  if (!first && rectsTouch(rect, ENTRANCE_BLOCK)) return false;
  return layout.rooms.every((room) => room.removed || ignore.has(room.id) || !rectsClash(rect, roomRect(room)));
}

function normalCount(layout: WorkLayout): number {
  return layout.rooms.filter((room) => !room.removed && isNormal(room)).length;
}

function growTree(seed: number, params: DungeonParams, root: QueuedRoom): WorkLayout {
  const layout: WorkLayout = { rooms: [], doors: [] };
  const queue: QueuedRoom[] = [root];
  let groups = 1;
  let normals = 0;
  for (let head = 0; head < queue.length; head++) {
    if (normals >= params.maxRooms || layout.rooms.length >= MAX_TOTAL_ROOMS) break;
    const item = queue[head] as QueuedRoom;
    const rng = stream(seed, 'layout', item.seed);
    const size = drawSize(rng, params);
    const room: WorkRoom = {
      id: layout.rooms.length,
      origin: item.origin,
      axis: item.axis,
      width: size.width,
      depth: size.depth,
      group: item.group,
      parent: item.parent,
      removed: false,
      wing: 'regular',
      zone: REGULAR_ZONE,
      ending: false,
      rotunda: false,
      colonnade: false,
    };
    if (!roomFits(layout, roomRect(room), new Set(), item.parent === null)) {
      const [next, ...rest] = item.fallbacks;
      if (next) queue.push({ ...next, fallbacks: rest, parent: item.parent, group: item.group });
      continue;
    }
    layout.rooms.push(room);
    const parent = item.parent === null ? null : roomAt(layout, item.parent);
    const kind = parent === null ? 'entrance' : drawDoorKind(rng, !isNormal(parent) && !isNormal(room));
    layout.doors.push({ x: item.origin.x, y: item.origin.y, dir: item.axis, kind, from: item.parent, to: room.id, loop: false });
    if (isNormal(room)) normals++;
    for (const group of branchesOf(rng, room, item.flip, params)) {
      const id = groups++;
      group.forEach((branch) => queue.push({ ...branch, parent: room.id, group: id }));
    }
  }
  return layout;
}

/** The grown tree, with at least the tags' fewest rooms where any attempt reached them. */
export function growLayout(seed: number, params: DungeonParams): WorkLayout {
  let best: WorkLayout | null = null;
  let bestCount = -1;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = stream(seed, 'layout', `attempt:${attempt}`);
    const axis = pick(rng, AXES);
    const root: QueuedRoom = { parent: null, origin: { x: 0, y: 0 }, axis, flip: false, seed: int(rng, 1, MAX_SEED), group: 0, fallbacks: [] };
    const layout = growTree(seed, params, root);
    const count = normalCount(layout);
    if (count >= params.minRooms) return layout;
    if (count > bestCount) {
      best = layout;
      bestCount = count;
    }
  }
  if (!best) throw new Error('no dungeon layout');
  return best;
}

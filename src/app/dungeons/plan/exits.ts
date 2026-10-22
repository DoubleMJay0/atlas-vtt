/** The rear entrance and the stairs down. */

import type { DungeonParams } from '../params';
import { type Rng, chance, pick, weighted } from '../rng';
import { dir } from '../geometry';
import { REGULAR_ZONE, type WorkLayout, isNormal, liveRooms, localCell, roomAt } from '../layout/workLayout';
import { type FeatureMap, addFeature } from './features';
import { type OuterCell, freeOuterCells, isFreeOuterCell } from './outerDoors';

/** A second way in, in the outer wall of a room far from the first, the farther the likelier. */
export function placeBackdoor(rng: Rng, layout: WorkLayout, params: DungeonParams, costs: readonly number[], features: FeatureMap): void {
  if (!chance(rng, params.backdoorChance)) return;
  let options = liveRooms(layout).filter((room) => room.id !== 0 && room.zone === REGULAR_ZONE && isNormal(room) && Number.isFinite(costs[room.id]));
  while (options.length > 0) {
    const room = weighted(rng, options.map((option) => [option, (costs[option.id] ?? 0) ** 2 + 1] as const));
    const cells = freeOuterCells(layout, room);
    if (cells.length === 0) {
      options = options.filter((option) => option !== room);
      continue;
    }
    const { cell, out } = pick(rng, cells);
    layout.doors.push({ x: cell.x, y: cell.y, dir: dir(-out.x, -out.y), kind: 'entrance', from: null, to: room.id, loop: false });
    addFeature(features, room.id, { kind: 'backdoor' });
    return;
  }
}

/** Stairs down in the culmination's far wall, its middle if free. */
export function placeStairsDown(rng: Rng, layout: WorkLayout, params: DungeonParams, ending: number, features: FeatureMap): void {
  if (!params.multiLevel) return;
  const room = roomAt(layout, ending);
  const middle = localCell(room, room.depth - 1, 0);
  const preferred: OuterCell = { cell: middle, out: room.axis };
  const options = freeOuterCells(layout, room);
  if (options.length === 0) return;
  const { cell, out } = isFreeOuterCell(layout, room, middle, room.axis) ? preferred : pick(rng, options);
  layout.doors.push({ x: cell.x, y: cell.y, dir: out, kind: 'stairs-down', from: room.id, to: null, loop: false });
  addFeature(features, room.id, { kind: 'stairs-down' });
}

/**
 * Whether a floor's layout can be shaped into a cave that keeps its token-fit rules: every
 * chamber has room for a 3 × 3 block of its own, and the main path fits two cells wide. Asked of
 * every attempt at a Cavern floor, so a floor that cannot is grown anew.
 */

import { CaveGrid, type CaveFloorPlan } from './caveGrid';
import { coreBlock } from './chambers';
import { type LaneEnd, mainRoute, wideLane } from './mainPath';

export function caveFits(floor: CaveFloorPlan, from: LaneEnd, to: LaneEnd, index: number): boolean {
  const grid = new CaveGrid(floor, index);
  if (floor.rooms.some((room) => room.kind === 'room' && coreBlock(grid, room).length === 0)) return false;
  const route = mainRoute(floor, from, to);
  return route.length > 0 && wideLane(grid, floor, route, from, to) !== null;
}

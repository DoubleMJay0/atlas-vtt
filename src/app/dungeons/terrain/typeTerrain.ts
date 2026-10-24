/**
 * The terrain and furniture of a room the theme typed: its lanes kept clear first, then its
 * recipe placed through the room's cells, where the theme's facts allow, offering only kinds with
 * a drawing.
 */

import { DRAWN_PROP_KINDS } from '../drawnKinds';
import { cellsOf, cellKey, inRect, wallRect } from '../geometry';
import type { DungeonRoom } from '../model';
import { spotRect } from '../floors/stairSpots';
import { furnishSpace } from '../props/furnishSpace';
import { type RecipeContext, furnishByRecipe } from '../props/recipe';
import { frameOf } from '../props/roomFrame';
import { roomSpace } from '../props/space';
import type { RoomTypeId } from '../themes/roomTypes';
import type { RoomTypeSpec } from '../themes/themeTypes';
import type { FloorTerrain } from './floorTerrain';
import { type RoomCells, WALL_SIDES, type WallSide } from './roomCells';
import { reserveLanes } from './roomLanes';
import type { TerrainWork } from './work';

/** A room's type and how its recipe is read there. */
export interface TypedRoom {
  spec: RoomTypeSpec;
  context: RecipeContext;
}

/** The sides of a room whose wall has no other room's walls on it or a cell beyond it. */
export function outerSides(rc: RoomCells, rooms: readonly DungeonRoom[]): ReadonlySet<WallSide> {
  const others = rooms.filter((room) => room.id !== rc.room.id).map(wallRect);
  return new Set(WALL_SIDES.filter((side) => {
    const d = rc.beyond(side);
    const band = rc.wallCells(side).flatMap((c) => [{ x: c.x + d.x, y: c.y + d.y }, { x: c.x + 2 * d.x, y: c.y + 2 * d.y }]);
    return band.every((c) => others.every((rect) => !inRect(rect, c.x, c.y)));
  }));
}

/** The cells furniture keeps off in a room: its stairwells, the cells it must keep reachable, and every cell terrain fills. */
function keptClear(floor: FloorTerrain, rc: RoomCells): Set<string> {
  const stairs = floor.plan.stairs.flatMap((s) => cellsOf(spotRect(s))).filter((c) => rc.isFloor(c));
  return new Set([...floor.takenCells(), ...[...stairs, ...rc.needed].map((c) => cellKey(c.x, c.y))]);
}

/** Lanes, then the type's furniture by its recipe. */
export function furnishTypedRoom(work: TerrainWork, k: number, rc: RoomCells, spec: RoomTypeSpec, context: RecipeContext): void {
  const floor = work.floors[k];
  if (!floor) return;
  const { room } = rc;
  reserveLanes(rc);
  const fs = furnishSpace({
    floor,
    cells: rc,
    space: roomSpace(frameOf(room), keptClear(floor, rc), floor.plan.columns),
    rng: work.rng(k, `recipe:${room.id}`),
    offered: DRAWN_PROP_KINDS,
    doors: floor.plan.doors,
    placeAllowed: (kind, at) => work.theme.facts.placeAllowed(kind, at, { floor: k, room: room.id }),
    outer: outerSides(rc, floor.plan.rooms),
  });
  furnishByRecipe(fs, spec.furnish, context);
}

/**
 * Where each room of a repeated type ranks by depth among the rooms of its type: 0 the
 * shallowest, 1 the deepest, 0.5 for a type held once; by floor, then room id.
 */
export function depthRanks(types: readonly ReadonlyMap<number, RoomTypeId>[], depthOf: (floor: number, room: number) => number): Map<number, number>[] {
  const byType = new Map<RoomTypeId, { floor: number; room: number; depth: number }[]>();
  types.forEach((floorTypes, floor) => {
    for (const [room, type] of floorTypes) byType.set(type, [...(byType.get(type) ?? []), { floor, room, depth: depthOf(floor, room) }]);
  });
  const out = types.map(() => new Map<number, number>());
  for (const rooms of byType.values()) {
    const ranked = [...rooms].sort((a, b) => a.depth - b.depth || a.floor - b.floor || a.room - b.room);
    ranked.forEach((r, k) => out[r.floor]?.set(r.room, ranked.length === 1 ? 0.5 : k / (ranked.length - 1)));
  }
  return out;
}

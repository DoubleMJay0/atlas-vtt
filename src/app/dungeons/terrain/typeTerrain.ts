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
import type { FurnishRecipe, Piece, RoomTypeSpec } from '../themes/themeTypes';
import { PROP_SPECS } from '../props/catalogue';
import { type Rng, chance } from '../rng';
import { CRAMPED_AREA, FIGHT_AREA, ensureCover, hasCover, pillars } from './cover';
import { pews } from './difficult';
import { platformAtFarWall } from './elevation';
import { placeInterest } from './interest';
import { againstWall, inCorner } from '../props/cellVerbs';
import { type FurnishSpace } from '../props/furnishSpace';
import type { DungeonTag } from '../tags';
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

/** A recipe as a room that took its hazard keeps it: only the formations nature made. */
function naturalOnly(recipe: FurnishRecipe): FurnishRecipe {
  const natural = (piece: Piece | undefined): boolean => piece !== undefined && PROP_SPECS[piece.kind].natural === true;
  return { ...(natural(recipe.defining) && { defining: recipe.defining }), pieces: recipe.pieces.filter(natural) };
}

/**
 * The terrain the type allows beyond its furniture: pews in a chapel, a summoning circle, columns
 * of pillars in a hall. A platform at the far wall only where nothing of the recipe stands there.
 */
function allowedTerrain(work: TerrainWork, k: number, rc: RoomCells, spec: RoomTypeSpec, rng: Rng): void {
  const floor = work.floors[k];
  if (!floor) return;
  if (spec.terrain.allows?.includes('pews') && rc.floorCount >= FIGHT_AREA) pews(floor, rc);
  if (spec.terrain.allows?.includes('mosaic')) placeInterest(floor, rc, rng, 'mosaic');
  if (spec.terrain.allows?.includes('pool') && chance(rng, 0.5)) placeInterest(floor, rc, rng, 'pool');
  if (spec.terrain.allows?.includes('pillar') && rc.floorCount > CRAMPED_AREA && chance(rng, 0.6)) pillars(floor, rc, rng);
  const atBack = spec.furnish.defining?.verb === 'backWall';
  if (spec.terrain.allows?.includes('platform') && !atBack && rc.depth >= 6 && chance(rng, 0.4)) platformAtFarWall(floor, rc, 1, rc.width - 2, 1);
}

/**
 * Cover in a furnished room that can hold a fight and has none: the first piece of its recipe that
 * gives cover, else a crate in a corner, else crates as terrain. A room with only pictures on its
 * walls is not furnished for a fight.
 */
export function ensureTypeCover(fs: FurnishSpace, spec: RoomTypeSpec, tags: ReadonlySet<DungeonTag>): void {
  const { floor, cells: rc } = fs;
  if (rc.floorCount < FIGHT_AREA || !fs.placed.some((p) => !PROP_SPECS[p.prop.kind].wallPiece)) return;
  const covered = (): boolean => hasCover(floor, rc) || fs.placed.some((p) => PROP_SPECS[p.prop.kind].cover !== undefined);
  if (covered()) return;
  const pieces = [spec.furnish.defining, spec.furnish.with, ...spec.furnish.pieces].filter((p): p is Piece => p !== undefined);
  const cover = pieces.find((p) => PROP_SPECS[p.kind].cover !== undefined && !PROP_SPECS[p.kind].wallPiece && fs.offered.has(p.kind));
  if (cover && againstWall(fs, cover.kind, ['back', 'left', 'right', 'near'])) return;
  if (inCorner(fs, 'crate')) return;
  ensureCover(floor, rc, tags);
}

/** Lanes, the terrain the type allows, then its furniture by its recipe (only nature's in a room that took its hazard), then cover. */
export function furnishTypedRoom(work: TerrainWork, k: number, rc: RoomCells, spec: RoomTypeSpec, context: RecipeContext, hazarded = false): void {
  const floor = work.floors[k];
  if (!floor) return;
  const { room } = rc;
  const rng = work.rng(k, `type:${room.id}`);
  reserveLanes(rc);
  if (!hazarded) allowedTerrain(work, k, rc, spec, rng);
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
  furnishByRecipe(fs, hazarded ? naturalOnly(spec.furnish) : spec.furnish, context);
  if (!hazarded) ensureTypeCover(fs, spec, work.tags);
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

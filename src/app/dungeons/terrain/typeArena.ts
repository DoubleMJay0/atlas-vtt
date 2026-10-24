/**
 * The boss room of a typed dungeon: the arena its climax type describes, its seat on the platform
 * (a throne only in a Fortress throne room), then the climax type's other pieces by its recipe.
 */

import { cellKey, perpendicular } from '../geometry';
import type { DungeonProp, DungeonTerrain, PropKind } from '../model';
import { PROP_SPECS, isCellPiece } from '../props/catalogue';
import { arenaSeat } from '../props/furnish';
import { type FurnishSpace, centreOf, record } from '../props/furnishSpace';
import { furnishByRecipe } from '../props/recipe';
import { facing } from '../props/roomFrame';
import { occupyCells } from '../props/space';
import type { Rng } from '../rng';
import { programmeOf } from '../themes/themes';
import type { ArenaSpec } from '../themes/themeTypes';
import { furnishArena } from './arena';
import type { RoomCells } from './roomCells';
import { type TypedRoom, typedSpace } from './typeTerrain';
import type { TerrainWork } from './work';

/** What cannot be walked in an arena takes at most this share of its floor, furniture and all. */
const ARENA_OPEN = 0.4;

/** An arena with nothing of its own: for a typed boss room whose type is no climax, which then takes no hazard and no set piece. */
const PLAIN_ARENA: ArenaSpec = { seat: null, setPieces: [], mirrored: ['pillar', 'wall-fragment'], hazards: [] };

/** The arena of a typed boss room: its climax type's, else a plain one. */
export function arenaOf(work: TerrainWork, typed: TypedRoom): ArenaSpec {
  return programmeOf(work.theme.definition, work.tags)?.climax.find((c) => c.type === typed.spec.id)?.arena ?? PLAIN_ARENA;
}

/** The arena's seat on the middle of its platform, facing down its steps: a cell piece on whole platform cells, a disc on one; none where the arena has no seat or it is not drawn. */
export function seatOnPlatform(fs: FurnishSpace, platform: DungeonTerrain, arena: ArenaSpec): DungeonProp | null {
  const kind = arenaSeat(arena);
  const towards = platform.facing;
  if (!kind || !towards || !fs.offered.has(kind)) return null;
  const spec = PROP_SPECS[kind];
  const { cells: rc } = fs;
  const own = new Set(platform.cells.map((c) => cellKey(c.x, c.y)));
  const middle = centreOf(platform.cells);
  const along = perpendicular(towards);
  const footprint = isCellPiece(spec) ? spec.footprint : { along: 1, out: 1 };
  const places = platform.cells
    .map((start) => Array.from({ length: footprint.along * footprint.out }, (_, k) => ({ x: start.x + along.x * (k % footprint.along) - towards.x * Math.floor(k / footprint.along), y: start.y + along.y * (k % footprint.along) - towards.y * Math.floor(k / footprint.along) })))
    .filter((cells) => cells.every((c) => own.has(cellKey(c.x, c.y))))
    .sort((a, b) => Math.hypot(centreOf(a).x - middle.x, centreOf(a).y - middle.y) - Math.hypot(centreOf(b).x - middle.x, centreOf(b).y - middle.y));
  const blocks = spec.footing !== 'walk';
  const cells = places.find((c) => c.every((cell) => fs.placeAllowed?.(kind, cell) ?? true) && (!blocks || rc.allowsOnWalked(c)));
  if (!cells) return null;
  if (blocks) rc.take(cells, 'block');
  occupyCells(fs.space, cells);
  const at = isCellPiece(spec) ? centreOf(cells) : middle;
  const prop: DungeonProp = { kind, x: at.x, y: at.y, rotation: facing(towards), scale: 1, room: rc.room.id };
  return record(fs, { prop, cells, clear: [], facing: towards });
}

/** The arena of its climax type, its seat (on its platform, else at its back wall; in a cave in the middle of its floor), then the type's pieces besides what it is defined by (a throne room's tapestries, statues and rug). */
export function furnishTypedArena(work: TerrainWork, k: number, rc: RoomCells, rng: Rng, typed: TypedRoom): void {
  const floor = work.floors[k];
  if (!floor) return;
  const arena = arenaOf(work, typed);
  furnishArena(work, k, rc, rng, work.tags, arena);
  const base = typedSpace(work, k, rc, floor);
  // The arena stays open: what cannot be walked never takes more than this share of it.
  const open = (kind: PropKind): boolean => {
    const spec = PROP_SPECS[kind];
    const cells = spec.footing === 'block' ? (isCellPiece(spec) ? spec.footprint.along * spec.footprint.out : 1) : 0;
    return rc.blockedCount() + cells <= rc.floorCount * ARENA_OPEN;
  };
  const fs: FurnishSpace = { ...base, placeAllowed: (kind, at) => open(kind) && (base.placeAllowed?.(kind, at) ?? true) };
  const platform = floor.inRoom(rc.room.id).find((p) => p.kind === 'platform' && p.facing);
  const seat = platform ? seatOnPlatform(fs, platform, arena) : null;
  const { pieces } = typed.spec.furnish;
  const kind = arenaSeat(arena);
  if (work.cave) {
    // A cave's arena has no dais: its seat lies in the middle of the floor, a beast's nest or a chief's bedding.
    if (!platform && kind) furnishByRecipe(fs, { defining: { kind, verb: 'centre' }, pieces: [] }, typed.context);
  } else if (!seat && kind && fs.offered.has(kind) && furnishByRecipe(fs, { defining: { kind, verb: 'backWall' }, pieces }, typed.context).length > 0) {
    // An arena too small for a platform has its seat at its back wall: a chapel's altar, a throne.
    return;
  }
  furnishByRecipe(fs, { pieces }, typed.context);
}

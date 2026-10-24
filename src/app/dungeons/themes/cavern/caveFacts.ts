/**
 * What a Cavern knows of its rooms beyond their traits, read from its geology (`caveSites`):
 * which rooms a type may take (a lake only where water gathers, a gallery along a fault, lava and
 * acid only deep and with their tags), and which it suits best.
 */

import { caveSites, type CaveSites } from '../../layout/cavern/caveSites';
import { caveVariant } from '../../layout/cavern/caveParams';
import { nearFault } from '../../layout/cavern/faults';
import type { CaveVariant, DungeonFloor } from '../../model';
import { neighbours } from '../../roomGraph';
import type { DungeonTag } from '../../tags';
import type { RoomTypeId } from '../roomTypes';
import type { RoomRef, ThemeFacts, ThemeFactsInput } from '../themeTypes';

export interface CaveFacts {
  sites: CaveSites[];
  variant: CaveVariant;
  inhabited: boolean;
  tags: ReadonlySet<DungeonTag>;
  floors: readonly Pick<DungeonFloor, 'rooms' | 'doors' | 'stairs' | 'cave'>[];
  /** The directions the cave's faults run in. */
  faults: readonly number[];
}

export function caveFacts(input: ThemeFactsInput, sites: readonly CaveSites[]): CaveFacts {
  const faults = [...new Set(input.floors.flatMap((floor) => floor.cave?.faults.map((f) => f.angle) ?? []))];
  return { sites: [...sites], variant: caveVariant(input.tags), inhabited: false, tags: input.tags, floors: input.floors, faults };
}

/** The angle the room is longest along, from its rectangle. */
function roomAxis(room: DungeonFloor['rooms'][number]): number {
  return room.w >= room.h ? 0 : Math.PI / 2;
}

/** Whether the room ends a stream, at its low end. */
function streamEnd(facts: CaveFacts, ref: RoomRef): boolean {
  return (facts.floors[ref.floor]?.cave?.streams ?? []).some((s) => s[s.length - 1] === ref.room);
}

/** Whether the room holds the lower end of a pitch: an aven. */
function underPitch(facts: CaveFacts, ref: RoomRef): boolean {
  const floor = facts.floors[ref.floor];
  const room = floor?.rooms[ref.room];
  if (!floor || !room) return false;
  return floor.stairs.some((s) => s.way === 'pitch' && s.to < ref.floor && s.x >= room.x && s.x + s.w <= room.x + room.w && s.y >= room.y && s.y + s.h <= room.y + room.h);
}

function doors(facts: CaveFacts, ref: RoomRef): number {
  const floor = facts.floors[ref.floor];
  return floor ? (neighbours(floor.rooms.length, floor.doors)[ref.room]?.length ?? 0) : 0;
}

/** The facts' own rules: where a type may stand beyond its traits. */
function allowsType(facts: CaveFacts, type: RoomTypeId, ref: RoomRef): boolean {
  const site = facts.sites[ref.floor];
  const floor = facts.floors[ref.floor];
  const room = floor?.rooms[ref.room];
  if (!site || !floor || !room) return true;
  const cave = floor.cave;
  const basin = cave?.basins.includes(ref.room) ?? false;
  const dry = facts.tags.has('dry');
  switch (type) {
    case 'cave-mouth':
    case 'den':
      return !facts.inhabited;
    case 'flowstone-gallery':
      return nearFault(roomAxis(room), facts.faults, Math.PI / 6);
    case 'lake-cavern':
      return basin || (room.boss && !dry && (cave?.dams.includes(ref.room) ?? false));
    case 'stream-passage':
      return (cave?.streams ?? []).some((s) => s.slice(0, -1).includes(ref.room));
    case 'sump':
      return basin && streamEnd(facts, ref);
    case 'chasm-hall':
      return site.faultOf(ref.room) !== null;
    case 'collapse-chamber':
      return doors(facts, ref) >= 3 || underPitch(facts, ref);
    case 'fungus-grove':
      return site.nearWater(ref.room, 1);
    case 'crystal-grotto':
      return basin || (neighbours(floor.rooms.length, floor.doors)[ref.room] ?? []).some((n) => cave?.basins.includes(n));
    case 'lava-tube':
      return facts.tags.has('lava') && site.deep(ref.room);
    case 'sulphur-spring':
      return facts.tags.has('acid') && site.deep(ref.room) && site.faultOf(ref.room) !== null;
    case 'roost':
      return (site.hopsFromMouth[ref.room] ?? Infinity) <= 1;
    default:
      return true;
  }
}

export function cavernThemeFacts(facts: CaveFacts): ThemeFacts {
  return {
    allows: (type, ref) => allowsType(facts, type, ref),
    score: (type, ref) => {
      if (type === 'lake-cavern' && facts.sites[ref.floor]?.deepest) return 2;
      if (type === 'crystal-grotto' && facts.floors[ref.floor]?.cave?.basins.includes(ref.room)) return 1;
      return 0;
    },
    placeAllowed: () => true,
    richness: () => 1,
  };
}

/** The Cavern's facts from the floors assignment receives. */
export function cavernFacts(input: ThemeFactsInput): ThemeFacts {
  return cavernThemeFacts(caveFacts(input, caveSites(input.floors)));
}

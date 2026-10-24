/**
 * A dungeon's theme put to work on its planned floors: for a theme with a room programme every
 * normal room gets its type (`DungeonRoom.type`), and each typed room what its recipe reads there
 * (its rank by depth among rooms of its type, dust sheets past the front third, the theme's
 * richness). A theme without a programme types nothing.
 */

import { floorAbove, floorStack } from '../floors/floorStack';
import type { PlannedFloor } from '../floors/planFloors';
import type { DungeonTag } from '../tags';
import { type TypedRoom, depthRanks } from '../terrain/typeTerrain';
import { assignRoomTypes, type RoomTypes } from './assign/assignRoomTypes';
import { roomTraits } from './assign/roomTraits';
import { specOf } from './assign/score';
import { NO_FACTS, type ThemeContext, programmeOf, themeOf } from './themes';
import type { ThemeId } from './themeTypes';

export interface ThemedFloors {
  theme: ThemeContext;
  /** The assignment; null for a theme that furnishes by roles. */
  typed: RoomTypes | null;
  /** Each floor's typed rooms and how their recipes read them. */
  rooms: ReadonlyMap<number, TypedRoom>[];
}

export function typeDungeon(seed: number, id: ThemeId, tags: ReadonlySet<DungeonTag>, floors: readonly PlannedFloor[]): ThemedFloors {
  const definition = themeOf(id);
  const ruined = tags.has('ruined');
  const facts = definition.facts?.({ seed, tags, floors }) ?? NO_FACTS;
  const theme: ThemeContext = { definition, ruined, facts };
  const programme = programmeOf(definition, tags);
  if (!programme) return { theme, typed: null, rooms: floors.map(() => new Map()) };
  const stack = floorStack(definition.rise, floors.length);
  const typed = assignRoomTypes({ seed, programme, floors, ruined, facts, above: (floor) => floorAbove(stack, floor) });
  const traits = roomTraits(floors);
  const traitOf = (floor: number, room: number): (typeof traits)[number] | undefined => traits.find((t) => t.floor === floor && t.room === room);
  const ranks = depthRanks(typed.byFloor, (floor, room) => traitOf(floor, room)?.depth ?? 0);
  const rooms = floors.map((floor, index) => {
    const out = new Map<number, TypedRoom>();
    for (const room of floor.rooms) {
      const type = typed.byFloor[index]?.get(room.id);
      const spec = type ? specOf(programme, type) : undefined;
      if (!type || !spec) continue;
      room.type = type;
      // Only a type that keeps columns keeps the colonnade the layout gave its room.
      if (!spec.terrain.columns) room.colonnade = false;
      const sheeted = programme.sheeted !== undefined && traitOf(index, room.id)?.band !== 'front' ? programme.sheeted : 0;
      out.set(room.id, { spec, context: { depthRank: ranks[index]?.get(room.id) ?? 0.5, ruined, sheeted, richness: facts.richness({ floor: index, room: room.id }) } });
    }
    return out;
  });
  return { theme, typed, rooms };
}

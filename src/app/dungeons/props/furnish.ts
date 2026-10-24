/**
 * Furniture from what a room is in the architecture (`roles.ts`), for the rooms of a theme without
 * a room programme (the Cavern until its own plan; typed rooms follow their recipes, `recipe.ts`): the boss room and the largest hall get a dais
 * at the far wall or a centrepiece, the deepest room a statue or a tapestry over a chest, hubs a
 * fountain, well or statue, dead ends storage, other rooms a little of everything. Nothing implies
 * treasure.
 */

import type { DungeonDoor, DungeonProp, PropKind } from '../model';
import type { DungeonTag } from '../tags';
import type { ArenaSpec } from '../themes/themeTypes';
import { type Rng, chance, weighted } from '../rng';
import { beforeBackWall, centrepiece, dais, storage, tapestry } from './arrange';
import type { RoomRole } from './roles';
import type { RoomSpace } from './space';

/** Shared across a floor: one well at most, and each fountain halves the next one's chance. */
export interface FloorFurnishing {
  tags: ReadonlySet<DungeonTag>;
  tapestryChance: number;
  fountainWeight: number;
  wellPlaced: boolean;
}

/** What stands on the boss arena's platform: its climax type's seat; none without one, so no arena has a throne by default. */
export function arenaSeat(arena?: ArenaSpec): PropKind | null {
  return arena?.seat ?? null;
}

function centreKind(rng: Rng, floor: FloorFurnishing): PropKind {
  const kind = weighted<PropKind>(rng, [
    ['statue', 1.5],
    ['fountain', 2 * floor.fountainWeight],
    ['well', floor.wellPlaced ? 0 : 0.5],
  ]);
  if (kind === 'well') floor.wellPlaced = true;
  if (kind === 'fountain') floor.fountainWeight /= 2;
  return kind;
}

function hall(rng: Rng, space: RoomSpace, doors: readonly DungeonDoor[], floor: FloorFurnishing): DungeonProp[] {
  const onDais = chance(rng, 0.6) ? dais(space, doors, 'statue') : [];
  const props = onDais.length > 0 ? onDais : centrepiece(space, centreKind(rng, floor));
  if (chance(rng, floor.tapestryChance / 2)) props.push(...tapestry(space, doors));
  return props;
}

function deepest(rng: Rng, space: RoomSpace, doors: readonly DungeonDoor[]): DungeonProp[] {
  return chance(rng, 0.5) ? beforeBackWall(space, doors, ['statue']) : [...tapestry(space, doors), ...beforeBackWall(space, doors, ['chest'])];
}

function plain(rng: Rng, space: RoomSpace, doors: readonly DungeonDoor[], floor: FloorFurnishing): DungeonProp[] {
  const choice = weighted(rng, [
    ['storage', 3],
    ['tapestry', floor.tapestryChance * 3],
    ['statue', 0.7],
    ['chest', 0.7],
  ] as const);
  switch (choice) {
    case 'storage':
      return storage(rng, space);
    case 'tapestry':
      return tapestry(space, doors);
    default:
      return beforeBackWall(space, doors, [choice]);
  }
}

/** A room's furniture for its role; a room left without any by its choice gets storage where it can. */
export function furnishRoom(rng: Rng, space: RoomSpace, role: RoomRole, doors: readonly DungeonDoor[], floor: FloorFurnishing): DungeonProp[] {
  const props = ((): DungeonProp[] => {
    switch (role) {
      case 'boss':
      case 'hall':
        return hall(rng, space, doors, floor);
      case 'deepest':
        return deepest(rng, space, doors);
      case 'hub':
        return centrepiece(space, centreKind(rng, floor));
      case 'dead-end':
      case 'stairs':
        return storage(rng, space);
      case 'plain':
        return plain(rng, space, doors, floor);
    }
  })();
  return props.length > 0 ? props : storage(rng, space);
}

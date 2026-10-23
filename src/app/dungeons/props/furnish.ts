/**
 * Furniture from what a room is (`roles.ts`) and the dungeon's theme: the largest hall gets a dais
 * at its far wall or a centrepiece, the deepest room a shrine, a tomb or a seat, hubs a fountain,
 * well or statue, dead ends storage, shrines or tombs, other rooms a little of everything. Temple,
 * tomb and dwelling decide what stands where; nothing implies treasure or a fight.
 */

import type { DungeonDoor, DungeonProp, PropKind } from '../model';
import type { DungeonTag } from '../tags';
import { type Rng, chance, int, pick, weighted } from '../rng';
import { beforeBackWall, centrepiece, dais, row, storage, tapestry } from './arrange';
import type { RoomRole } from './roles';
import type { RoomSpace } from './space';

type Theme = 'temple' | 'tomb' | 'dwelling' | null;

/** Shared across a floor: one well at most, and each fountain halves the next one's chance. */
export interface FloorFurnishing {
  tags: ReadonlySet<DungeonTag>;
  tapestryChance: number;
  fountainWeight: number;
  wellPlaced: boolean;
}

const THEMES: readonly Exclude<Theme, null>[] = ['temple', 'tomb', 'dwelling'];

function themeOf(rng: Rng, tags: ReadonlySet<DungeonTag>): Theme {
  const held = THEMES.filter((theme) => tags.has(theme));
  return held.length > 0 && chance(rng, 0.75) ? pick(rng, held) : null;
}

const SEAT_OF: Readonly<Record<Exclude<Theme, null>, PropKind>> = { temple: 'altar', tomb: 'sarcophagus', dwelling: 'throne' };

function seat(theme: Theme): PropKind {
  return theme ? SEAT_OF[theme] : 'statue';
}

function centreKind(rng: Rng, theme: Theme, floor: FloorFurnishing): PropKind {
  const well = floor.wellPlaced ? 0 : theme === 'dwelling' ? 3 : 0.5;
  const fountain = (theme === 'tomb' ? 0.3 : 2) * floor.fountainWeight;
  const kind = weighted<PropKind>(rng, [
    ['statue', theme === 'temple' || theme === 'tomb' ? 3 : 1.5],
    ['fountain', fountain],
    ['well', well],
  ]);
  if (kind === 'well') floor.wellPlaced = true;
  if (kind === 'fountain') floor.fountainWeight /= 2;
  return kind;
}

function hall(rng: Rng, space: RoomSpace, doors: readonly DungeonDoor[], theme: Theme, floor: FloorFurnishing): DungeonProp[] {
  const onDais = chance(rng, 0.6) ? dais(space, doors, seat(theme)) : [];
  const props = onDais.length > 0 ? onDais : centrepiece(space, centreKind(rng, theme, floor));
  if (theme === 'dwelling' || chance(rng, floor.tapestryChance / 2)) props.push(...tapestry(space, doors));
  return props;
}

function deepest(rng: Rng, space: RoomSpace, doors: readonly DungeonDoor[], theme: Theme): DungeonProp[] {
  switch (theme) {
    case 'temple':
      return beforeBackWall(space, doors, chance(rng, 0.5) ? ['altar', 'statue', 'statue'] : ['altar']);
    case 'tomb':
      return row(space, 'sarcophagus', int(rng, 1, 2));
    case 'dwelling':
      return [...beforeBackWall(space, doors, ['throne']), ...tapestry(space, doors)];
    default:
      return chance(rng, 0.5) ? beforeBackWall(space, doors, ['statue']) : [...tapestry(space, doors), ...beforeBackWall(space, doors, ['chest'])];
  }
}

function deadEnd(rng: Rng, space: RoomSpace, doors: readonly DungeonDoor[], theme: Theme): DungeonProp[] {
  switch (theme) {
    case 'temple':
      return beforeBackWall(space, doors, chance(rng, 0.5) ? ['altar'] : ['statue']);
    case 'tomb':
      return row(space, 'sarcophagus', int(rng, 1, 2));
    case 'dwelling':
      return [...storage(rng, space), ...(chance(rng, 0.5) ? tapestry(space, doors) : [])];
    default:
      return storage(rng, space);
  }
}

function plain(rng: Rng, space: RoomSpace, doors: readonly DungeonDoor[], theme: Theme, floor: FloorFurnishing): DungeonProp[] {
  const choice = weighted(rng, [
    ['storage', 3],
    ['tapestry', floor.tapestryChance * 3],
    ['statue', theme === 'temple' ? 2 : 0.7],
    ['sarcophagus', theme === 'tomb' ? 2 : 0],
    ['chest', 0.7],
  ] as const);
  switch (choice) {
    case 'storage':
      return storage(rng, space);
    case 'tapestry':
      return tapestry(space, doors);
    case 'sarcophagus':
      return row(space, 'sarcophagus', 1);
    default:
      return beforeBackWall(space, doors, [choice]);
  }
}

/** A room's furniture for its role; a room left without any by its choice gets storage where it can. */
export function furnishRoom(rng: Rng, space: RoomSpace, role: RoomRole, doors: readonly DungeonDoor[], floor: FloorFurnishing): DungeonProp[] {
  const theme = themeOf(rng, floor.tags);
  const props = ((): DungeonProp[] => {
    switch (role) {
      case 'hall':
        return hall(rng, space, doors, theme, floor);
      case 'deepest':
        return deepest(rng, space, doors, theme);
      case 'hub':
        return centrepiece(space, centreKind(rng, theme, floor));
      case 'dead-end':
        return deadEnd(rng, space, doors, theme);
      case 'stairs':
        return storage(rng, space);
      case 'plain':
        return plain(rng, space, doors, theme, floor);
    }
  })();
  return props.length > 0 ? props : storage(rng, space);
}

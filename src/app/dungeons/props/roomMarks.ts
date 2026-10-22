/**
 * What a room's plan puts in it beyond its walls: the props its features call for, a pool, more
 * rubble. Chosen from the features and the tags alone (a temple has altars, a tomb sarcophagi, a
 * dwelling thrones and tapestries, a wet dungeon pools, a crumbling one rubble), each room from a
 * stream of its own, before water is laid, since a pool is part of the water.
 */

import type { DungeonRoom, PropKind } from '../model';
import type { FeatureMap, RoomFeature } from '../plan/features';
import { type Rng, stream, weighted } from '../rng';
import type { DungeonTag } from '../tags';

export interface RoomMarks {
  /** Set in the room's aisle (`markedProps`); the culmination keeps its own. */
  props: PropKind[];
  /** A pool in the room. */
  water: boolean;
  /** A few more stones. */
  rubble: boolean;
}

type Mark = PropKind | 'water' | 'rubble' | null;
type Choices = readonly (readonly [Mark, number])[];

/** What a feature may bring, by weight; a choice whose tag the dungeon lacks has none. */
function choicesFor(kind: RoomFeature['kind'], has: (tag: DungeonTag) => boolean): Choices {
  const wet = has('wet') || has('flooded');
  const when = (on: boolean, mark: Mark, weight: number): readonly [Mark, number] => [mark, on ? weight : 0];
  switch (kind) {
    case 'environment':
      return [[null, 3], when(wet, 'water', 2), when(has('crumbling'), 'rubble', 2), when(has('tomb'), 'sarcophagus', 2), when(has('temple'), 'altar', 2), when(has('dwelling'), 'tapestry', 2)];
    case 'enemy':
      return [[null, 4], ['statue', 1], when(wet, 'water', 1), when(has('dangerous'), 'rubble', 3), when(has('crumbling'), 'rubble', 1), when(has('dwelling'), 'throne', 1)];
    case 'loot':
      return [['chest', 4], ['crate', 2], ['barrel', 1], ['statue', 1], when(has('treasure'), 'chest', 3), when(has('treasure'), 'statue', 1), when(has('tomb'), 'sarcophagus', 3), when(has('temple'), 'altar', 3), when(wet, 'water', 1), when(has('crumbling'), 'rubble', 1)];
    case 'key':
      return [['chest', 3], ['barrel', 1], ['statue', 1], when(has('tomb'), 'sarcophagus', 1), when(has('temple'), 'altar', 1), when(wet, 'water', 1), when(has('crumbling'), 'rubble', 1)];
    case 'event':
      return [['fountain', 2], ['well', 2], ['statue', 2], ['altar', 1], ['tapestry', 2], ['throne', 1], when(has('tomb'), 'sarcophagus', 2), when(has('temple'), 'altar', 2), when(has('dwelling'), 'throne', 1), when(has('dwelling'), 'tapestry', 1), when(wet, 'water', 1)];
    case 'stairs-down':
      return [[null, 1], when(wet, 'water', 1)];
    case 'gate':
    case 'backdoor':
      return [[null, 1]];
  }
}

/** How many things a feature brings: a treasure dungeon's loot rooms hold two. */
function picksFor(kind: RoomFeature['kind'], has: (tag: DungeonTag) => boolean): number {
  return kind === 'loot' && has('treasure') ? 2 : 1;
}

function marksOf(rng: Rng, features: readonly RoomFeature[], has: (tag: DungeonTag) => boolean): RoomMarks {
  const marks = new Set<Mark>();
  for (const { kind } of features) {
    const choices = choicesFor(kind, has).filter(([, weight]) => weight > 0);
    for (let k = picksFor(kind, has); k > 0; k--) marks.add(weighted(rng, choices));
  }
  const props = [...marks].filter((mark): mark is PropKind => mark !== null && mark !== 'water' && mark !== 'rubble');
  return { props, water: marks.has('water'), rubble: marks.has('rubble') };
}

/** The marks of every room that holds a feature, by room id. */
export function roomMarks(seed: number, rooms: readonly DungeonRoom[], features: FeatureMap, tags: ReadonlySet<DungeonTag>): Map<number, RoomMarks> {
  const has = (tag: DungeonTag): boolean => tags.has(tag);
  const out = new Map<number, RoomMarks>();
  for (const room of rooms) {
    const list = features.get(room.id);
    if (list && list.length > 0) out.set(room.id, marksOf(stream(seed, 'props', `marks:${room.id}`), list, has));
  }
  return out;
}

/**
 * A five-room dungeon (Johnn Four's structure) as architecture: four main rooms in a row, joined by
 * passages, the last of them the boss room, and a fifth, smaller room beyond it, behind a secret
 * door more often than not. No loops and no secret wings: the stages come in their order.
 */

import type { CompactLayout } from './compact';
import type { DungeonParams } from '../params';
import type { FiveRoomStage } from '../model';
import { FIVE_ROOM_STAGES } from '../model';
import { dir, perpendicular } from '../geometry';
import { type KeyedRng, chance, shuffled } from '../rng';
import { hops, neighbours } from '../roomGraph';
import { roomFits } from './grow';
import { REGULAR_ZONE, type WorkLayout, type WorkRoom, doorMayOpen, localCell, roomRect } from './workLayout';

/** The main rooms before the reward: entrance, puzzle, setback and the boss room. */
const MAIN_ROOMS = 4;
/** How often the reward lies behind a secret door. */
const SECRET_REWARD = 0.6;

/** A floor's params for a five-room dungeon: a string of four rooms with passages between them. */
export function fiveRoomParams(params: DungeonParams): DungeonParams {
  return {
    ...params,
    minRooms: MAIN_ROOMS,
    maxRooms: MAIN_ROOMS,
    string: true,
    symmetry: [false],
    sizeStyles: [0, 1, 1, 1, 2, 2, 3],
    secretWings: { chance: 0, extra: 0 },
    secretLoopChance: 0,
    secretEntranceWeight: 0,
  };
}

const REWARD_SIZES = [
  { width: 5, depth: 4 },
  { width: 5, depth: 5 },
  { width: 7, depth: 4 },
  { width: 5, depth: 6 },
];

/** The ways out of the boss room a reward room may grow through: its far wall's middle, or a side wall's. */
function exitsOf(boss: WorkRoom): { origin: WorkRoom['origin']; axis: WorkRoom['axis'] }[] {
  const half = (boss.width - 1) / 2;
  const side = perpendicular(boss.axis);
  const k = Math.floor((boss.depth - 1) / 2);
  return [
    { origin: localCell(boss, boss.depth - 1, 0), axis: boss.axis },
    { origin: localCell(boss, k, half), axis: side },
    { origin: localCell(boss, k, -half), axis: dir(-side.x, -side.y) },
  ];
}

/** Grows the reward room beyond the boss room; false where the rock leaves no room for it. */
export function addRewardRoom(rngOf: KeyedRng, layout: WorkLayout): boolean {
  const boss = layout.rooms.find((room) => room.boss && !room.removed);
  if (!boss) return false;
  const rng = rngOf('reward');
  const secret = chance(rng, SECRET_REWARD);
  for (const exit of shuffled(rng, exitsOf(boss))) {
    for (const size of shuffled(rng, REWARD_SIZES)) {
      const room: WorkRoom = {
        id: layout.rooms.length,
        ...exit,
        ...size,
        group: boss.group,
        parent: boss.id,
        removed: false,
        wing: secret ? 'secret' : 'regular',
        zone: secret ? REGULAR_ZONE + 1 : REGULAR_ZONE,
        rotunda: false,
        colonnade: false,
        fixed: false,
        boss: false,
      };
      if (!roomFits(layout, roomRect(room), new Set(), false) || !doorMayOpen(layout, exit.origin, exit.axis)) continue;
      layout.rooms.push(room);
      layout.doors.push({ ...exit.origin, dir: exit.axis, kind: secret ? 'secret' : 'door', from: boss.id, to: room.id, loop: false });
      return true;
    }
  }
  return false;
}

/** The stage of each main room: the first three normal rooms on the way in, the boss room, the room beyond it. */
export function withStages(layout: CompactLayout): CompactLayout {
  const boss = layout.rooms.find((room) => room.boss);
  const distance = hops(neighbours(layout.rooms.length, layout.doors), 0);
  const stageOf = new Map<number, FiveRoomStage>();
  if (boss) {
    stageOf.set(boss.id, 'climax');
    const reward = layout.rooms.find((room) => room.parent === boss.id && room.kind === 'room');
    if (reward) stageOf.set(reward.id, 'reward');
  }
  const before = layout.rooms
    .filter((room) => room.kind === 'room' && !stageOf.has(room.id))
    .sort((a, b) => (distance[a.id] ?? Infinity) - (distance[b.id] ?? Infinity) || a.id - b.id)
    .slice(0, 3);
  before.forEach((room, k) => stageOf.set(room.id, FIVE_ROOM_STAGES[k] as FiveRoomStage));
  return {
    ...layout,
    rooms: layout.rooms.map((room) => {
      const stage = stageOf.get(room.id);
      return stage ? { ...room, stage } : room;
    }),
  };
}

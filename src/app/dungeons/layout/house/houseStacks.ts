/**
 * Which of the places a house's bands offer for a chimney stack (`cutBands`) it builds (report
 * 2026-10-25-mansion-chimneys-research): few stacks, each carrying the flues of the heated rooms on
 * both faces of its cross wall on every floor. A house has one for about every `CELLS_PER_STACK`
 * ground cells, `FEWEST_STACKS` to `MOST_PLANNED`: a wing one, the main range the rest; the drawing room, dining room,
 * kitchen and master bedroom are given one first, then the stacks that warm the most rooms no
 * other stack warms. Rooms are typed with every place, so where a stack goes changes no room's type.
 */

import { cellKey } from '../../geometry';
import type { RoomTypeId } from '../../themes/roomTypes';
import type { CutBands } from './houseBands';
import { roomCells } from './houseEdges';
import type { HouseFrame, WingId } from './houseFrame';
import { type Box, boxCells } from './houseGrid';
import type { TypedRoom } from './houseZones';

/** Ground cells per stack, and the fewest and most stacks a house plans by its size; its main rooms may need one more. */
const CELLS_PER_STACK = 120;
const FEWEST_STACKS = 2;
const MOST_PLANNED = 6;
const MOST_STACKS = 7;

/** How much a heated room's fire counts towards choosing its stack; a room absent here has none. */
const WARMTH: Partial<Record<RoomTypeId, number>> = {
  'drawing-room': 4,
  'dining-room': 4,
  kitchen: 4,
  'master-bedroom': 4,
  saloon: 2,
  library: 2,
  ballroom: 2,
  bedroom: 2,
  nursery: 2,
  'servants-hall': 2,
  parlour: 1,
  study: 1,
  'entrance-hall': 1,
};

/** The reception rooms that may not be larger than the drawing room. */
const RECEPTION: ReadonlySet<RoomTypeId> = new Set(['dining-room', 'library', 'saloon', 'parlour']);

/** The rooms given a stack before any other. */
const MAIN: ReadonlySet<RoomTypeId> = new Set(['drawing-room', 'dining-room', 'kitchen', 'master-bedroom']);

/** Whether a fire warms a room of this type. */
export const isWarmed = (type: RoomTypeId | null): boolean => type !== null && WARMTH[type] !== undefined;

interface Place {
  stack: Box;
  wing: WingId;
  /** The heated rooms beside it, on every floor. */
  warms: TypedRoom[];
}

function borders(room: TypedRoom, stack: Box): boolean {
  const keys = new Set(boxCells(stack).map((c) => cellKey(c.x, c.y)));
  return roomCells(room).some((c) => keys.has(cellKey(c.x + 1, c.y)) || keys.has(cellKey(c.x - 1, c.y)) || keys.has(cellKey(c.x, c.y + 1)) || keys.has(cellKey(c.x, c.y - 1)));
}

/** The stacks a house builds, from the places its bands offer and its typed floors. */
export function chooseStacks(frame: HouseFrame, cut: CutBands, floors: readonly (readonly TypedRoom[])[]): Set<Box> {
  const places: Place[] = cut.stacks.map((stack) => ({
    stack,
    wing: cut.rooms[cut.notches.indexOf(stack)]!.wing,
    warms: floors.flatMap((rooms) => rooms.filter((r) => isWarmed(r.type) && !r.boss && borders(r, stack))),
  }));
  const cells = frame.wings.reduce((sum, w) => sum + w.box.w * w.box.h, 0);
  const most = Math.min(MOST_PLANNED, Math.max(FEWEST_STACKS, Math.round(cells / CELLS_PER_STACK)));
  const budget = new Map<WingId, number>(frame.wings.map((w) => [w.id, w.id === 'main' ? Math.max(1, most - frame.wings.length + 1) : 1]));
  const kept = new Set<Box>();
  const warm = new Set<TypedRoom>();
  const keep = (place: Place): void => {
    kept.add(place.stack);
    for (const r of place.warms) warm.add(r);
    budget.set(place.wing, budget.get(place.wing)! - 1);
  };
  const gain = (place: Place): number => place.warms.reduce((sum, r) => sum + (warm.has(r) ? 0 : WARMTH[r.type!]!), 0);
  const open = (limit: number): Place[] => places.filter((p) => !kept.has(p.stack) && kept.size < limit);
  const best = (choices: Place[]): Place | undefined => choices.reduce<Place | undefined>((b, p) => (!b || gain(p) > gain(b) ? p : b), undefined);
  // The main rooms first, by the stacks that serve most of them at once (a drawing room and the master bedroom over it), within their part's share where they can and past the house's where they must.
  const mainGain = (place: Place): number => place.warms.filter((r) => MAIN.has(r.type!) && !warm.has(r)).length;
  const firstChoice = (): Place | undefined => {
    const serving = open(MOST_STACKS).filter((p) => mainGain(p) > 0);
    const within = serving.filter((p) => budget.get(p.wing)! > 0);
    const top = Math.max(0, ...serving.map(mainGain));
    return best(within.filter((p) => mainGain(p) === top)) ?? best(serving.filter((p) => mainGain(p) === top));
  };
  for (let next = firstChoice(); next; next = firstChoice()) keep(next);
  // A reception room whose place stays floor may grow past the drawing room, which it was typed beside: it keeps its stack.
  const ground = floors[0]!;
  const size = (r: TypedRoom): number => r.box.w * r.box.h - (r.notch && kept.has(r.notch) ? r.notch.w * r.notch.h : 0);
  const drawing = ground.find((r) => r.type === 'drawing-room');
  for (const r of ground) if (drawing && r.notch && RECEPTION.has(r.type!) && !r.boss && size(r) > size(drawing) && kept.size < MOST_STACKS) keep(places.find((p) => p.stack === r.notch)!);
  // Then the stacks that warm most rooms no other warms, within each part's share; none cut from the drawing room, which would shrink it again.
  const rest = (): Place | undefined => best(open(most).filter((p) => budget.get(p.wing)! > 0 && gain(p) > 0 && p.stack !== drawing?.notch));
  for (let next = rest(); next; next = rest()) keep(next);
  return kept;
}

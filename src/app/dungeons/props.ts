/**
 * Everything that stands or lies in the rooms: columns, the culmination's dais, the props the
 * plan marks (`roomMarks`), random props in rooms the plan leaves empty, rubble and cracks. Each
 * room draws from a stream of its own, so one room's things never move another's.
 */

import type { DungeonColumn, DungeonCrack, DungeonDoor, DungeonProp, DungeonRoom, DungeonRubble } from './model';
import type { DungeonParams } from './params';
import type { FeatureMap } from './plan/features';
import { columnStyle, colonnadeOf } from './props/columns';
import { type ClearZone, culminationProps, markedProps } from './props/markedProps';
import { type RandomPropState, randomProps } from './props/randomProps';
import { frameOf } from './props/roomFrame';
import { cracksIn, rubbleIn } from './props/scatter';
import { stream } from './rng';
import type { RoomMarks } from './props/roomMarks';

export interface PropsResult {
  columns: DungeonColumn[];
  props: DungeonProp[];
  rubble: DungeonRubble[];
  cracks: DungeonCrack[];
}

export interface PropsInput {
  seed: number;
  rooms: readonly DungeonRoom[];
  doors: readonly DungeonDoor[];
  /** By room id (`roomMarks`). */
  marks: ReadonlyMap<number, RoomMarks>;
  features: FeatureMap;
  params: DungeonParams;
}

const MARKED_RUBBLE = 3;
const PROP_CLEARANCE = 0.45;

export function placeProps(input: PropsInput): PropsResult {
  const { seed, rooms, doors, marks, features, params } = input;
  const style = columnStyle(stream(seed, 'props', 'style'), params.shatteredChance);
  const state: RandomPropState = { fountainChance: params.fountainChance, wellPlaced: false };
  const result: PropsResult = { columns: [], props: [], rubble: [], cracks: [] };
  for (const room of rooms) {
    const rng = stream(seed, 'props', room.id);
    const frame = frameOf(room);
    const marked = marks.get(room.id);
    const zones: ClearZone[] = [];
    const props: DungeonProp[] = [];
    if (room.ending) {
      const culmination = culminationProps(rng, frame, doors, params.tags);
      props.push(...culmination.props);
      zones.push(culmination.clear);
    } else if (marked && marked.props.length > 0) {
      props.push(...markedProps(frame, doors, marked.props));
    } else if (room.kind === 'room' && !room.colonnade && !features.has(room.id)) {
      props.push(...randomProps(rng, frame, doors, params, state));
    }
    const columns = colonnadeOf(stream(seed, 'props', `columns:${room.id}`), room, style).filter((c) => !zones.some((z) => Math.hypot(c.x - z.x, c.y - z.y) < z.radius));
    const obstacles = [
      ...zones,
      ...columns.map((c) => ({ x: c.x, y: c.y, radius: c.radius + 0.15 })),
      ...props.map((p) => ({ x: p.x, y: p.y, radius: PROP_CLEARANCE })),
    ];
    result.columns.push(...columns);
    result.props.push(...props);
    result.rubble.push(...rubbleIn(rng, frame, params.rubbleArea, marked?.rubble ? MARKED_RUBBLE : 0, obstacles));
    result.cracks.push(...cracksIn(rng, frame, doors, params.crackChance));
  }
  return result;
}

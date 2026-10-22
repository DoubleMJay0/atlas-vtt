/**
 * Props a room is known for: those its plan calls for (`roomMarks`), set in the aisle before the
 * back wall, and the culmination's dais with what stands on it.
 */

import type { DungeonDoor, DungeonProp, PropKind } from '../model';
import type { DungeonTag } from '../tags';
import { type Rng, chance, pick } from '../rng';
import { type RoomFrame, backWallOpen, facingIn, onFloor, pointIn } from './roomFrame';

/** Where something stands that columns and stones must leave free. */
export interface ClearZone {
  x: number;
  y: number;
  radius: number;
}

const FREESTANDING: ReadonlySet<PropKind> = new Set<PropKind>(['fountain', 'well']);
/** Across-the-room slots, middle first. */
const SLOTS = [0, -1, 1, -2, 2, -3, 3];

function prop(frame: RoomFrame, kind: PropKind, u: number, v: number, scale = 1): DungeonProp {
  const at = pointIn(frame, u, v);
  return { kind, x: at.x, y: at.y, rotation: facingIn(frame), scale, room: frame.room.id };
}

/** A room's marked props: wells and fountains in the middle, a tapestry on the back wall, the rest in the aisle before it. */
export function markedProps(frame: RoomFrame, doors: readonly DungeonDoor[], kinds: readonly PropKind[]): DungeonProp[] {
  const open = backWallOpen(frame, doors);
  const unique = [...new Set(kinds)];
  const out: DungeonProp[] = [];
  const standing = unique.find((kind) => FREESTANDING.has(kind));
  const centred = standing !== undefined && onFloor(frame, frame.centre, 0.4);
  if (standing !== undefined && centred) out.push(prop(frame, standing, 0, 0));
  if (unique.includes('tapestry') && !open) out.push(prop(frame, 'tapestry', frame.halfDepth - 0.1, 0));
  const aisle = open ? 0 : frame.halfDepth - 0.5;
  const slots = SLOTS.filter((v) => onFloor(frame, pointIn(frame, aisle, v), 0.3) && !(open && centred && v === 0));
  unique
    .filter((kind) => !FREESTANDING.has(kind) && kind !== 'tapestry')
    .forEach((kind, k) => {
      const v = slots[k];
      if (v !== undefined) out.push(prop(frame, kind, aisle, v));
    });
  return out;
}

const CULMINATION_ITEMS: readonly (readonly [DungeonTag, PropKind])[] = [
  ['temple', 'altar'],
  ['tomb', 'sarcophagus'],
  ['dwelling', 'throne'],
];

function culminationItem(rng: Rng, tags: ReadonlySet<DungeonTag>): PropKind {
  const options = CULMINATION_ITEMS.filter(([tag]) => tags.has(tag)).map(([, kind]) => kind);
  return options.length > 0 ? pick(rng, options) : 'statue';
}

/** A dais at the back wall with the place's centrepiece; in the middle where the back wall has a way on. */
export function culminationProps(
  rng: Rng,
  frame: RoomFrame,
  doors: readonly DungeonDoor[],
  tags: ReadonlySet<DungeonTag>,
): { props: DungeonProp[]; clear: ClearZone } {
  const item = culminationItem(rng, tags);
  const stairs = doors.some((d) => d.kind === 'stairs-down' && d.from === frame.room.id);
  if (frame.room.rotunda) {
    const centre = { ...frame.centre, radius: 0.9 };
    return { props: [prop(frame, 'dais', 0, 0, 0.6), prop(frame, item, 0, 0)], clear: centre };
  }
  if (backWallOpen(frame, doors) || (stairs && chance(rng, 0.5))) {
    return { props: [prop(frame, stairs ? 'statue' : item, 0, 0)], clear: { ...frame.centre, radius: 0.6 } };
  }
  const scale = Math.min(1, frame.halfWidth / 1.5, (2 * frame.halfDepth - 0.5) / 1.5);
  const at = pointIn(frame, frame.halfDepth, 0);
  return {
    props: [prop(frame, 'dais', frame.halfDepth, 0, scale), prop(frame, item, frame.halfDepth - 0.75 * scale, 0)],
    clear: { x: at.x, y: at.y, radius: 1.5 * scale + 0.3 },
  };
}

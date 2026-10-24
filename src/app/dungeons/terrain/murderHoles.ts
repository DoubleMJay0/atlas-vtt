/**
 * Murder holes: small holes cut in the floor over a gatehouse's gate passage, in a row along it with
 * a cell of floor between each, so defenders above can see and strike whoever comes through the
 * gate. Each is one cell of the room above, walked over (too small to fall through), and opens onto
 * the passage below; nothing is placed in the gatehouse for them.
 */

import type { CellPoint, DungeonDoor, DungeonRoom } from '../model';
import { floorAbove } from '../floors/floorStack';
import { type Rng, chance } from '../rng';
import { draft } from './catalog';
import { reasonsOf } from './typeReasons';
import type { TerrainWork } from './work';

/** How often a gatehouse with a room over its passage has murder holes. */
const MURDER_HOLE_CHANCE = 0.85;
/** At most this many holes over one passage. */
const MOST_HOLES = 4;

/** The door a gate passage begins at: the gatehouse's entrance from outside, else the first door into it. */
function gateDoor(doors: readonly DungeonDoor[], room: DungeonRoom): DungeonDoor | undefined {
  return doors.find((d) => d.from === null && d.to === room.id) ?? doors.find((d) => d.to === room.id);
}

/** The cells of the passage from the door straight across the room, nearest first. */
function passage(room: DungeonRoom, door: DungeonDoor): CellPoint[] {
  const out: CellPoint[] = [];
  for (let at = { x: door.x + door.dir.x, y: door.y + door.dir.y }; at.x >= room.x && at.x < room.x + room.w && at.y >= room.y && at.y < room.y + room.h; at = { x: at.x + door.dir.x, y: at.y + door.dir.y }) out.push(at);
  return out;
}

/** Murder holes over the gate passage of every gatehouse whose type gives the reason, where a room lies over it. */
export function murderHoles(work: TerrainWork): void {
  work.floors.forEach((floor, k) => {
    const top = floorAbove(work.stack, k);
    const above = work.floors[top ?? -1];
    if (top === null || !above) return;
    for (const room of floor.plan.rooms) {
      const typed = work.typed(k, room.id);
      if (!typed || !reasonsOf(typed.spec, work.theme.ruined).some((r) => r.at === 'above' && r.kinds.includes('murder-hole'))) continue;
      const door = gateDoor(floor.plan.doors, room);
      if (door) cutRow(work, top, k, passage(room, door), work.rng(top, `murder-holes:${room.id}`));
    }
  });
}

/**
 * A row of holes over every other cell of the passage, from just inside the gate or from the cell
 * after it, in the one room above that lies over the most of them; at least two.
 */
function cutRow(work: TerrainWork, top: number, k: number, way: readonly CellPoint[], rng: Rng): void {
  const above = work.floors[top];
  const gate = work.floors[k]?.roomHolding(way.slice(0, 1));
  if (!above || !gate || !chance(rng, MURDER_HOLE_CHANCE)) return;
  const rows = [0, 1].flatMap((first) => {
    const spots = way.filter((c, t) => t % 2 === first && gate.isFloor(c));
    const rooms = [...new Set(spots.map((c) => above.roomHolding([c])))];
    return rooms.flatMap((rc) => (rc ? [{ rc, cells: spots.filter((c) => above.roomHolding([c]) === rc).slice(0, MOST_HOLES) }] : []));
  });
  const fits = rows.filter(({ rc, cells }) => cells.length >= 2 && rc.room.wing === 'regular' && !rc.room.boss && rc.room.stage === undefined && rc.allows(cells, 'walk'));
  const best = fits.sort((a, b) => b.cells.length - a.cells.length)[0];
  if (!best) return;
  for (const c of best.cells) above.place({ ...draft('murder-hole', best.rc.room.id, [c]), opening: { bottom: k, link: work.nextLink() } });
}

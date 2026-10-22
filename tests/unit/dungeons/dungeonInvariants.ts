/** Checks every generated dungeon must pass; each returns a list of problems, empty when sound. */

import { floorRect, inRect, rectsTouch, wallRect } from '../../../src/app/dungeons/geometry';
import type { DungeonDoor, DungeonModel, DungeonRoom } from '../../../src/app/dungeons/model';
import { roomShape, rotundaRadius, roomCentre, shapeDistance } from '../../../src/app/dungeons/render/geometry';
import { REFERENCE_CELL_PX } from '../../../src/app/dungeons/style';
import { DUNGEON_STYLES } from '../../../src/app/dungeons/styleCatalog';

/** The widest wall any preset draws outside a floor, in cells. */
const WALL = Math.max(...DUNGEON_STYLES.map(({ style }) => style.strokes.thick)) / REFERENCE_CELL_PX;

const IMPASSABLE = new Set(['portcullis', 'barricade']);

function roomOf(model: DungeonModel, id: number | null): DungeonRoom | undefined {
  return id === null ? undefined : model.rooms[id];
}

export function floorProblems(model: DungeonModel): string[] {
  const out: string[] = [];
  model.rooms.forEach((a) => {
    model.rooms.forEach((b) => {
      if (a.id !== b.id && rectsTouch(floorRect(a), wallRect(b))) out.push(`floor ${a.id} runs into the walls of ${b.id}`);
    });
  });
  return out;
}

/**
 * A rotunda's circle and its wall ring stay clear of every other room's floor and wall ring; only
 * in a door cell may they meet, where the door joins them.
 */
export function rotundaProblems(model: DungeonModel): string[] {
  const out: string[] = [];
  const inDoorCell = (x: number, y: number): boolean => model.doors.some((door) => x >= door.x && x <= door.x + 1 && y >= door.y && y <= door.y + 1);
  for (const rotunda of model.rooms.filter((room) => room.rotunda)) {
    const c = roomCentre(rotunda);
    const reach = rotundaRadius(rotunda) + WALL;
    for (const other of model.rooms) {
      if (other.id === rotunda.id) continue;
      const shape = roomShape(other);
      for (let i = 0; i < 360; i++) {
        const a = (i / 360) * Math.PI * 2;
        const x = c.x + Math.cos(a) * reach;
        const y = c.y + Math.sin(a) * reach;
        if (shapeDistance(shape, x, y) < WALL && !inDoorCell(x, y)) {
          out.push(`rotunda ${rotunda.id} meets room ${other.id} at ${x.toFixed(2)},${y.toFixed(2)}`);
          break;
        }
      }
    }
  }
  return out;
}

function onAnyFloor(model: DungeonModel, x: number, y: number): boolean {
  return model.rooms.some((room) => inRect(floorRect(room), x, y));
}

function inAnyRoom(model: DungeonModel, x: number, y: number): boolean {
  return model.rooms.some((room) => inRect(wallRect(room), x, y));
}

function doorProblem(model: DungeonModel, door: DungeonDoor): string | null {
  const from = roomOf(model, door.from);
  const to = roomOf(model, door.to);
  const before = { x: door.x - door.dir.x, y: door.y - door.dir.y };
  const after = { x: door.x + door.dir.x, y: door.y + door.dir.y };
  const where = `${door.kind} door at ${door.x},${door.y}`;
  if (onAnyFloor(model, door.x, door.y)) return `${where} lies on a floor`;
  if (!from && !to) return `${where} joins nothing`;
  if (from ? !inRect(floorRect(from), before.x, before.y) : inAnyRoom(model, before.x, before.y)) return `${where}: wrong side behind`;
  if (to ? !inRect(floorRect(to), after.x, after.y) : inAnyRoom(model, after.x, after.y)) return `${where}: wrong side ahead`;
  if (from && !inRect(wallRect(from), door.x, door.y)) return `${where} not in the wall of ${from.id}`;
  if (to && !inRect(wallRect(to), door.x, door.y)) return `${where} not in the wall of ${to.id}`;
  const outer = door.from === null || door.to === null;
  if (outer !== (door.kind === 'entrance' || door.kind === 'stairs-down')) return `${where} has the wrong kind for its sides`;
  return null;
}

export function doorProblems(model: DungeonModel): string[] {
  const cells = new Set<string>();
  const out: string[] = [];
  for (const door of model.doors) {
    const key = `${door.x},${door.y}`;
    if (cells.has(key)) out.push(`two doors at ${key}`);
    cells.add(key);
    const problem = doorProblem(model, door);
    if (problem) out.push(problem);
  }
  return out;
}

/** Every room can be walked to from the first through doors a party can pass. */
export function unreachableRooms(model: DungeonModel): number[] {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const at = queue.shift() as number;
    for (const door of model.doors) {
      if (door.from === null || door.to === null || IMPASSABLE.has(door.kind)) continue;
      const next = door.from === at ? door.to : door.to === at ? door.from : null;
      if (next !== null && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return model.rooms.filter((room) => !seen.has(room.id)).map((room) => room.id);
}

/** Which side of the gate or which secret wing a room is in. */
function zoneOf(model: DungeonModel, room: DungeonRoom): string {
  if (room.wing === 'approach' || room.wing === 'culmination') return 'gated';
  if (room.wing !== 'secret') return 'regular';
  let head = room;
  for (let parent = roomOf(model, head.parent); parent && parent.wing === 'secret'; parent = roomOf(model, parent.parent)) head = parent;
  return `secret:${head.id}`;
}

/** Doors that let a party past the gate or into a secret wing without the gate or secret door. */
export function bypasses(model: DungeonModel): string[] {
  const out: string[] = [];
  for (const door of model.doors) {
    const from = roomOf(model, door.from);
    const to = roomOf(model, door.to);
    if (!from || !to || IMPASSABLE.has(door.kind)) continue;
    const a = zoneOf(model, from);
    const b = zoneOf(model, to);
    if (a === b) continue;
    const allowed = (a === 'regular' && b === 'gated' && door.kind === 'gate') || (b.startsWith('secret') && door.kind === 'secret');
    if (!allowed) out.push(`${door.kind} door from ${a} into ${b}`);
  }
  return out;
}

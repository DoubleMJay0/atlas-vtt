import type { DungeonModel, DungeonRoom, PropKind } from '../model';
import type { NotesMode } from '../style';
import { pointInPolygon, roomCentre, shapeDistance, type Canvas2D, type Vec } from './geometry';
import type { Palette } from './palette';
import type { VisibleDungeon } from './visibleDungeon';

/** How far a prop reaches from its centre at scale 1, in cells. */
const PROP_REACH: Record<PropKind, number> = {
  barrel: 0.3,
  crate: 0.4,
  chest: 0.5,
  fountain: 0.55,
  well: 0.45,
  statue: 0.4,
  sarcophagus: 0.5,
  altar: 0.45,
  throne: 0.4,
  dais: 1.5,
  tapestry: 0.3,
};

/** Room a number needs around its centre, in cells: half a printed numeral and a little air. */
const LABEL_CLEARANCE = 0.45;

/** A number printed on the map, at a room's centre in cells. */
export interface RoomLabel {
  room: number;
  text: string;
  at: Vec;
}

/** Which rooms carry a number in a notes mode: the noted ones, or every room in Numbers. */
export function roomLabels(dungeon: VisibleDungeon, mode: NotesMode): RoomLabel[] {
  if (mode === 'off' || mode === 'tailed') return [];
  const centreOf = (id: number): Vec | null => {
    const room = dungeon.rooms.find(r => r.id === id);
    return room ? labelSpot(dungeon, room) : null;
  };
  if (mode === 'numbers') {
    return roomsByDistance(dungeon.model)
      .filter(id => dungeon.roomShapes.has(id))
      .map((room, i) => ({ room, text: String(i + 1), at: centreOf(room)! }));
  }
  return dungeon.model.notes.flatMap(note => {
    const at = dungeon.roomShapes.has(note.room) ? centreOf(note.room) : null;
    return at ? [{ room: note.room, text: note.ref, at }] : [];
  });
}

/**
 * Where a room's number goes: its centre, or where the centre holds a prop or a column, the
 * nearest place inside the room that keeps clear of them.
 */
export function labelSpot(dungeon: VisibleDungeon, room: DungeonRoom): Vec {
  const centre = roomCentre(room);
  const shape = dungeon.roomShapes.get(room.id);
  const { model } = dungeon;
  const things: { x: number; y: number; r: number }[] = [
    ...model.props.filter(p => p.room === room.id).map(p => ({ x: p.x, y: p.y, r: PROP_REACH[p.kind] * p.scale })),
    ...model.columns.map(c => ({ x: c.x, y: c.y, r: c.radius })),
    ...model.rubble.map(stone => {
      const x = stone.points.reduce((sum, p) => sum + p.x, 0) / stone.points.length;
      const y = stone.points.reduce((sum, p) => sum + p.y, 0) / stone.points.length;
      return { x, y, r: stone.points.reduce((m, p) => Math.max(m, Math.hypot(p.x - x, p.y - y)), 0) };
    }),
  ].filter(t => t.x > room.x - 1 && t.x < room.x + room.w + 1 && t.y > room.y - 1 && t.y < room.y + room.h + 1);
  const clearance = (p: Vec): number => things.reduce((m, t) => Math.min(m, Math.hypot(p.x - t.x, p.y - t.y) - t.r), Infinity);
  if (clearance(centre) >= LABEL_CLEARANCE || !shape) return centre;
  const reach = Math.max(room.w, room.h) / 2;
  let best = centre;
  let bestScore = Infinity;
  for (let dy = -reach; dy <= reach; dy += 0.25) {
    for (let dx = -reach; dx <= reach; dx += 0.25) {
      const p = { x: centre.x + dx, y: centre.y + dy };
      if (shapeDistance(shape, p.x, p.y) > -0.45) continue;
      const free = Math.min(clearance(p), LABEL_CLEARANCE);
      // Clear first, then near the centre.
      const score = (LABEL_CLEARANCE - free) * 100 + Math.hypot(dx, dy);
      if (score < bestScore) {
        best = p;
        bestScore = score;
      }
    }
  }
  return best;
}

/** Normal rooms, nearest the entrance first by the number of doors between. */
export function roomsByDistance(model: DungeonModel): number[] {
  const links = new Map<number, number[]>();
  for (const door of model.doors) {
    if (door.from === null || door.to === null) continue;
    links.set(door.from, [...(links.get(door.from) ?? []), door.to]);
    links.set(door.to, [...(links.get(door.to) ?? []), door.from]);
  }
  const start = model.doors.find(d => d.kind === 'entrance' && d.from === null)?.to ?? model.rooms[0]?.id;
  const depth = new Map<number, number>();
  if (start !== undefined) {
    depth.set(start, 0);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i]!;
      for (const next of links.get(at) ?? []) {
        if (depth.has(next)) continue;
        depth.set(next, depth.get(at)! + 1);
        queue.push(next);
      }
    }
  }
  return model.rooms
    .filter(room => room.kind === 'room')
    .map(room => room.id)
    .sort((a, b) => (depth.get(a) ?? Infinity) - (depth.get(b) ?? Infinity) || a - b);
}

/** The colour around a number: the water's where it stands in a pool, else the floor's. */
export function haloAt(dungeon: VisibleDungeon, palette: Pick<Palette, 'floor' | 'water'>, showWater: boolean, at: Vec): string {
  const wet = showWater && dungeon.model.water.some(pool => pointInPolygon(pool.outline, at.x, at.y));
  return wet ? palette.water : palette.floor;
}

/**
 * Prints numbers in screen pixels (the context unturned), each over a halo of floor colour so
 * it reads over grid and props.
 */
export function drawLabels(ctx: Canvas2D, labels: readonly { text: string; x: number; y: number; halo: string }[], font: string, ink: string, haloWidth: number): void {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = haloWidth;
  ctx.fillStyle = ink;
  for (const label of labels) {
    const m = ctx.measureText(label.text);
    // Centre the ink, not the em box: numerals sit on the baseline.
    const dy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.strokeStyle = label.halo;
    ctx.strokeText(label.text, label.x, label.y + dy);
    ctx.fillText(label.text, label.x, label.y + dy);
  }
  ctx.restore();
}

import { cellsOf, floorCellsOf, holdsCell, roomArea } from '../../../src/app/dungeons/geometry';
import { caveSites } from '../../../src/app/dungeons/layout/cavern/caveSites';
import type { CellPoint, DungeonFloor, DungeonModel } from '../../../src/app/dungeons/model';
import { doorApproaches } from '../../../src/app/dungeons/floors/stairSpots';
import { PROP_SPECS } from '../../../src/app/dungeons/props/catalogue';
import { neighbours } from '../../../src/app/dungeons/roomGraph';
import { stairApproaches, stairCells } from './terrainInvariants';

/**
 * The believability rules of a Cavern, recomputed from the finished model (the spec's "Every
 * feature has a reason"): what each room type, hazard and liquid needs of the cave around it.
 */

/** Rule 8: a roost lies within a hop of the mouth, a fungus grove within a hop of water or a roost, the den deep. */
export function lifeProblems(model: DungeonModel): string[] {
  const sites = caveSites(model.floors);
  return model.floors.flatMap((floor, f) => {
    const site = sites[f]!;
    const near = neighbours(floor.rooms.length, floor.doors);
    return floor.rooms.flatMap((room) => {
      if (room.type === 'roost' && (site.hopsFromMouth[room.id] ?? Infinity) > 1) return [`floor ${f}: a roost ${site.hopsFromMouth[room.id]} hops from the mouth`];
      if (room.type === 'fungus-grove' && !site.nearWater(room.id, 1) && !(near[room.id] ?? []).some((n) => floor.rooms[n]?.type === 'roost')) return [`floor ${f}: a fungus grove far from water and roosts`];
      if (room.type === 'den' && !site.deep(room.id)) return [`floor ${f}: a den that is not deep`];
      return [];
    });
  });
}

/** A room that takes a hazard holds no furniture but what nature made in it; a hole from the floor above is that floor's. */
export function hazardFurnishProblems(model: DungeonModel, f: number): string[] {
  const floor = model.floors[f]!;
  const fromAbove = new Set(model.floors.slice(0, f).flatMap((above) => above.terrain.flatMap((p) => (p.opening ? [p.opening.link] : []))));
  const hazarded = new Set(floor.terrain.filter((p) => p.traits.hazard && !(p.opening && fromAbove.has(p.opening.link))).map((p) => p.room));
  return floor.props.filter((p) => hazarded.has(p.room) && !PROP_SPECS[p.kind].natural).map((p) => `a ${p.kind} in hazard room ${p.room}`);
}

type Liquid = 'water' | 'lava' | 'acid';

const LIQUID_OF: Readonly<Partial<Record<string, Liquid>>> = { 'deep-water': 'water', lava: 'lava', acid: 'acid' };

/** At most one liquid in a room: water, lava or acid. */
export function liquidProblems(floor: DungeonFloor): string[] {
  return floor.rooms.flatMap((room) => {
    const liquids = new Set<Liquid>();
    for (const piece of floor.terrain.filter((p) => p.room === room.id)) {
      const liquid = piece.kind === 'shallow-water' || piece.kind === 'pool' ? 'water' : LIQUID_OF[piece.traits.hazard ?? ''];
      if (liquid) liquids.add(liquid);
    }
    if (floor.waterCells.some((c) => holdsCell(room, c.x, c.y))) liquids.add('water');
    return liquids.size > 1 ? [`room ${room.id} holds ${[...liquids].join(' and ')}`] : [];
  });
}

const keyOf = (c: CellPoint): string => `${c.x},${c.y}`;
const within = (a: CellPoint, cells: readonly CellPoint[], d: number): boolean => cells.some((b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= d);

/** The direction cells run along, in [0, π), and how many times longer than wide they lie; worked out apart from the generator. */
function runOf(cells: readonly CellPoint[]): { angle: number; ratio: number } {
  const n = cells.length;
  const mx = cells.reduce((s, c) => s + c.x, 0) / n;
  const my = cells.reduce((s, c) => s + c.y, 0) / n;
  const sxx = cells.reduce((s, c) => s + (c.x - mx) ** 2, 0);
  const syy = cells.reduce((s, c) => s + (c.y - my) ** 2, 0);
  const sxy = cells.reduce((s, c) => s + (c.x - mx) * (c.y - my), 0);
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const big = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const small = Math.max(1e-9, tr - big);
  const angle = (((Math.atan2(2 * sxy, sxx - syy) / 2) % Math.PI) + Math.PI) % Math.PI;
  return { angle, ratio: Math.sqrt(big / small) };
}

const lineGap = (a: number, b: number): number => {
  const d = Math.abs((((a - b) % Math.PI) + Math.PI) % Math.PI);
  return Math.min(d, Math.PI - d);
};

/** Rule 2, 3 and 4: lava deep with its ledge, acid deep on a fault ringed by crust, every chasm along a fault. */
export function geologyProblems(model: DungeonModel, crust: boolean): string[] {
  const sites = caveSites(model.floors);
  const tags = new Set(model.tags);
  return model.floors.flatMap((floor, f) => {
    const site = sites[f]!;
    const out: string[] = [];
    const faults = model.cave?.faults ?? [];
    for (const piece of floor.terrain) {
      if (piece.traits.hazard === 'lava') {
        if (!tags.has('lava')) out.push(`floor ${f}: lava without the lava tag`);
        if (!site.deep(piece.room)) out.push(`floor ${f}: lava in room ${piece.room}, which is not deep`);
        if (!floor.terrain.some((p) => p.room === piece.room && p.kind === 'ledge')) out.push(`floor ${f}: lava in room ${piece.room} without a ledge`);
      }
      if (piece.traits.hazard === 'acid') {
        if (!tags.has('acid')) out.push(`floor ${f}: acid without the acid tag`);
        if (!site.deep(piece.room) || !site.faultOf(piece.room)) out.push(`floor ${f}: acid in room ${piece.room}, not deep on a fault`);
        if (crust && !floor.terrain.some((p) => p.room === piece.room && p.kind === 'sulphur-crust')) out.push(`floor ${f}: acid in room ${piece.room} without its crust`);
      }
      if (piece.kind === 'sulphur-crust' && !floor.terrain.some((p) => p.traits.hazard === 'acid' && piece.cells.every((c) => within(c, p.cells, 1)))) out.push(`floor ${f}: sulphur crust away from acid`);
      if (piece.kind === 'chasm' && piece.cells.length >= 4) {
        const { angle } = runOf(piece.cells);
        if (!faults.some((fault) => lineGap(angle, fault) <= Math.PI / 12)) out.push(`floor ${f}: chasm ${piece.id} runs at ${Math.round((angle * 180) / Math.PI)}°, along no fault`);
      }
    }
    return out;
  });
}

const BREAKDOWN = new Set(['rubble-heap', 'rubble-field']);

/** The cells whose middles lie in the middle third of the room's cells both ways. */
function middleThird(cells: readonly CellPoint[]): CellPoint[] {
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const third = (at: number, lo: number, hi: number): boolean => at + 0.5 >= lo + (hi - lo + 1) / 3 && at + 0.5 <= lo + ((hi - lo + 1) * 2) / 3;
  return cells.filter((c) => third(c.x, Math.min(...xs), Math.max(...xs)) && third(c.y, Math.min(...ys), Math.max(...ys)));
}

/** Rule 6: breakdown under the largest span of each floor; rubble at the foot of every pitch and shaft; boulder chokes only at a collapse chamber's door, walked. */
export function breakdownProblems(model: DungeonModel): { problems: string[]; spans: number; held: number } {
  let spans = 0;
  let held = 0;
  const problems = model.floors.flatMap((floor, f) => {
    const out: string[] = [];
    const rooms = floor.rooms.filter((r) => r.kind === 'room');
    const largest = rooms.reduce((best, r) => (roomArea(r) > roomArea(best) ? r : best), rooms[0]!);
    spans++;
    const middle = new Set(middleThird(floorCellsOf(largest)).map(keyOf));
    if (floor.terrain.some((p) => p.room === largest.id && BREAKDOWN.has(p.kind) && p.cells.some((c) => middle.has(keyOf(c))))) held++;
    const rubble = floor.terrain.filter((p) => BREAKDOWN.has(p.kind)).flatMap((p) => p.cells);
    const inRoom = (cells: readonly CellPoint[]): boolean => rooms.some((r) => cells.every((c) => holdsCell(r, c.x, c.y)));
    const feet = [
      ...floor.stairs.filter((s) => s.way === 'pitch' && s.to < f).map((s) => cellsOf({ x0: s.x, y0: s.y, x1: s.x + s.w - 1, y1: s.y + s.h - 1 })).filter(inRoom),
      ...floor.terrain.filter((p) => p.kind === 'chasm-floor' && p.name === 'dungeon.terrain.shaftFloor').map((p) => p.cells),
    ];
    // A foot with no floor to spare round it (a pitch filling a small chamber) has nowhere for rubble to lie.
    const kept = new Set([...stairCells(floor), ...stairApproaches(floor, f), ...rooms.flatMap((r) => doorApproaches(r, floor.doors))].map(keyOf));
    const spare = (foot: readonly CellPoint[]): boolean => rooms.some((r) => foot.every((c) => holdsCell(r, c.x, c.y)) && floorCellsOf(r).some((c) => !kept.has(keyOf(c)) && within(c, foot, 2) && !foot.some((d) => keyOf(d) === keyOf(c))));
    for (const foot of feet) if (spare(foot) && !rubble.some((c) => within(c, foot, 2))) out.push(`floor ${f}: no rubble at the foot at ${keyOf(foot[0]!)}`);
    for (const choke of floor.terrain.filter((p) => p.kind === 'boulder-choke')) {
      const room = floor.rooms[choke.room];
      const doors = floor.doors.filter((d) => d.from === choke.room || d.to === choke.room);
      if (room?.type !== 'collapse-chamber') out.push(`floor ${f}: a boulder choke in a ${room?.type}`);
      if (!choke.cells.every((c) => doors.some((d) => Math.abs(d.x - c.x) + Math.abs(d.y - c.y) <= 3))) out.push(`floor ${f}: a boulder choke away from its door`);
      if (!choke.traits.difficult || choke.traits.cover || choke.traits.hazard) out.push(`floor ${f}: a boulder choke that is not walked`);
    }
    return out;
  });
  return { problems, spans, held };
}

/** Rule 5: rimstone only where water steps down: beside water, a stream's way in, or steps. */
export function rimstoneProblems(model: DungeonModel): string[] {
  return model.floors.flatMap((floor, f) => floor.terrain.filter((p) => p.kind === 'rimstone').flatMap((piece) => {
    const room = piece.room;
    const water = [...floor.waterCells, ...floor.terrain.filter((p) => p.traits.hazard === 'deep-water' || p.kind === 'pool' || p.kind === 'shallow-water').flatMap((p) => p.cells)];
    const upstream = (floor.cave?.streams ?? []).flatMap((chain) => chain.flatMap((id, i) => (chain[i + 1] === room ? [id] : [])));
    const doors = floor.doors.filter((d) => (d.from === room || d.to === room) && (d.kind === 'steps' || upstream.includes((d.from === room ? d.to : d.from) ?? -1)));
    return piece.cells.every((c) => within(c, water, 1) || doors.some((d) => Math.max(Math.abs(d.x - c.x), Math.abs(d.y - c.y)) <= 2)) ? [] : [`floor ${f}: rimstone in room ${room} where no water steps down`];
  }));
}

const BLOCKING_FOOTING = (p: DungeonFloor['terrain'][number]): boolean => p.traits.hazard !== undefined || p.traits.cover !== undefined || ['pool', 'portal-ring', 'altar', 'statue', 'obelisk'].includes(p.kind);

/** Nothing that blocks, no hazard and no furniture on the lane; no furniture on a hazard or on blocking terrain. */
export function laneProblems(floor: DungeonFloor): string[] {
  const lane = new Set((floor.cave?.lane ?? []).map(keyOf));
  const blocked = new Set(floor.terrain.filter(BLOCKING_FOOTING).flatMap((p) => p.cells.map(keyOf)));
  const out: string[] = [];
  for (const piece of floor.terrain.filter(BLOCKING_FOOTING)) if (piece.cells.some((c) => lane.has(keyOf(c)))) out.push(`${piece.kind} ${piece.id} on the lane`);
  for (const prop of floor.props) {
    const at = `${Math.floor(prop.x)},${Math.floor(prop.y)}`;
    if (lane.has(at) && PROP_SPECS[prop.kind].footing === 'block') out.push(`a ${prop.kind} on the lane at ${at}`);
    if (blocked.has(at) && !PROP_SPECS[prop.kind].wallPiece && !floor.terrain.some((p) => p.kind === 'platform' && p.cells.some((c) => keyOf(c) === at))) out.push(`a ${prop.kind} on blocking terrain at ${at}`);
  }
  return out;
}

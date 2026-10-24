/**
 * What stands in a house's grounds beyond the way in (research §5.1.5–6): outbuildings as empty
 * walled buildings, each with its reason (a carriage house by the service side, off which a service
 * track runs to a gate of its own, a greenhouse on the garden side, the family crypt in the back
 * corner farthest from the service yard), each reached by a path; a parterre of hedged beds behind
 * the garden door, trees on the lawn, and the lawn round all of it.
 */

import { cellKey } from '../../geometry';
import type { CellDir, CellPoint, GroundsPiece, HouseGrounds, OutbuildingUse } from '../../model';
import { type Rng, int } from '../../rng';
import { type Box, box, boxCells, inBox } from './houseGrid';
import type { Lot } from './houseLot';
import type { HouseSize } from './houseParams';

const OUTBUILDINGS: Record<HouseSize, readonly OutbuildingUse[]> = {
  small: [],
  medium: ['carriage-house'],
  large: ['carriage-house', 'greenhouse', 'crypt'],
};

const STEPS: readonly CellDir[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

interface Ground {
  lot: Box;
  /** Cells nothing more may take, by key. */
  taken: Set<string>;
  pieces: GroundsPiece[];
}

const free = (g: Ground, c: CellPoint): boolean => inBox(g.lot, c.x, c.y) && !g.taken.has(cellKey(c.x, c.y));

/** A box of `w` × `h` with a cell of free ground all round it, nearest `target`. */
function siteFor(g: Ground, w: number, h: number, target: CellPoint): Box | null {
  let best: Box | null = null;
  let bestDistance = Infinity;
  for (let y = g.lot.y + 1; y + h < g.lot.y + g.lot.h; y++) {
    for (let x = g.lot.x + 1; x + w < g.lot.x + g.lot.w; x++) {
      const site = box(x, y, w, h);
      if (!boxCells(box(x - 1, y - 1, w + 2, h + 2)).every((c) => free(g, c))) continue;
      const d = Math.hypot(x + w / 2 - target.x, y + h / 2 - target.y);
      if (d < bestDistance) [best, bestDistance] = [site, d];
    }
  }
  return best;
}

/** The free cells of a way from `from` to the nearest cell `reaches` passes, a cell wide, or null. */
function pathTo(g: Ground, from: CellPoint, reaches: (c: CellPoint) => boolean): CellPoint[] | null {
  const back = new Map<string, string | null>([[cellKey(from.x, from.y), null]]);
  const queue: CellPoint[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const s of STEPS) {
      const next = { x: at.x + s.x, y: at.y + s.y };
      const key = cellKey(next.x, next.y);
      if (back.has(key)) continue;
      if (reaches(next)) {
        const path: CellPoint[] = [];
        for (let k: string | null = cellKey(at.x, at.y); k !== null; k = back.get(k) ?? null) {
          const [x, y] = k.split(',').map(Number) as [number, number];
          path.push({ x, y });
        }
        return path;
      }
      if (!free(g, next)) continue;
      back.set(key, cellKey(at.x, at.y));
      queue.push(next);
    }
  }
  return null;
}

function take(g: Ground, cells: readonly CellPoint[]): void {
  for (const c of cells) g.taken.add(cellKey(c.x, c.y));
}

/**
 * The grounds round a house's ground floor: `house` its cells by key, `around` their bounding box,
 * `east` whether the service side lies east, `garden` the cell outside the garden door.
 */
export function houseGrounds(rng: Rng, size: HouseSize, lot: Lot, house: ReadonlySet<string>, around: Box, east: boolean, garden: CellPoint | null): HouseGrounds {
  const g: Ground = { lot: lot.box, taken: new Set([...lot.taken, ...house]), pieces: [...lot.pieces] };
  // A cell of ground stays clear round the house, so nothing leans on its walls.
  for (const key of house) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    for (const s of STEPS) if (!house.has(cellKey(x + s.x, y + s.y)) && !lot.way.some((c) => c.x === x + s.x && c.y === y + s.y)) g.taken.add(cellKey(x + s.x, y + s.y));
  }
  const paths = new Set(lot.way.map((c) => cellKey(c.x, c.y)));
  const serviceX = east ? around.x + around.w + 2 : around.x - 3;
  let yard: Box | null = null;
  for (const use of OUTBUILDINGS[size]) {
    const target =
      use === 'carriage-house' ? { x: serviceX, y: around.y + around.h }
      : use === 'greenhouse' ? { x: east ? around.x : around.x + around.w, y: around.y - 3 }
      : farCorner(lot.box, yard);
    const [w, h] = use === 'greenhouse' ? [4, 3] : [3, 3];
    const site = siteFor(g, w, h, target);
    if (!site) continue;
    take(g, boxCells(site));
    const door = doorOf(site, { x: around.x + around.w / 2, y: around.y + around.h / 2 });
    const way = pathTo(g, door.outside, (c) => paths.has(cellKey(c.x, c.y)) || (garden !== null && c.x === garden.x && c.y === garden.y));
    if (!way) {
      for (const c of boxCells(site)) g.taken.delete(cellKey(c.x, c.y));
      continue;
    }
    take(g, way);
    for (const c of way) paths.add(cellKey(c.x, c.y));
    g.pieces.push({ kind: 'outbuilding', cells: boxCells(site), use, door: { x: door.outside.x, y: door.outside.y, dir: door.dir } }, { kind: 'path', cells: way });
    if (use === 'carriage-house') yard = site;
  }
  if (yard) farthestIsCrypt(g.pieces, yard);
  if (yard && lot.walled) serviceGate(g, yard, east);
  parterre(g, garden);
  const lawn = boxCells(lot.box).filter((c) => free(g, c));
  trees(rng, g, lawn);
  // The lawn is every cell of the lot nothing else stands on; trees stand on it.
  const built = new Set([...house, ...g.pieces.filter((p) => p.kind !== 'tree').flatMap((p) => p.cells.map((c) => cellKey(c.x, c.y)))]);
  g.pieces.push({ kind: 'garden', cells: boxCells(lot.box).filter((c) => !built.has(cellKey(c.x, c.y))) });
  return { lot: lot.box, pieces: g.pieces };
}

/** The back corner of the lot farthest from the service yard: where the family crypt stands. */
function farCorner(lot: Box, yard: Box | null): CellPoint {
  const corners = [{ x: lot.x + 2, y: lot.y + 2 }, { x: lot.x + lot.w - 3, y: lot.y + 2 }];
  if (!yard) return corners[0]!;
  return corners.sort((p, q) => Math.hypot(q.x - yard.x, q.y - yard.y) - Math.hypot(p.x - yard.x, p.y - yard.y))[0]!;
}

/** A building's door: in the middle of the side facing `toward`, its outside cell and the way in. */
function doorOf(site: Box, toward: CellPoint): { outside: CellPoint; dir: CellDir } {
  const cx = site.x + site.w / 2;
  const cy = site.y + site.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    const x = dx > 0 ? site.x + site.w : site.x - 1;
    return { outside: { x, y: site.y + Math.floor(site.h / 2) }, dir: { x: dx > 0 ? -1 : 1, y: 0 } };
  }
  const y = dy > 0 ? site.y + site.h : site.y - 1;
  return { outside: { x: site.x + Math.floor(site.w / 2), y }, dir: { x: 0, y: dy > 0 ? -1 : 1 } };
}

/** Coal never comes up the main approach (Kerr): a track from the yard to a gate of its own in the boundary on the service side. */
function serviceGate(g: Ground, yard: Box, east: boolean): void {
  const wall = g.pieces.find((p) => p.kind === 'boundary-wall' || p.kind === 'hedge');
  if (!wall) return;
  const x = east ? g.lot.x + g.lot.w - 1 : g.lot.x;
  const y = yard.y + Math.floor(yard.h / 2);
  const track: CellPoint[] = [];
  for (let at = east ? yard.x + yard.w : yard.x - 1; at !== x; at += east ? 1 : -1) track.push({ x: at, y });
  if (!track.every((c) => free(g, c))) return;
  wall.cells = wall.cells.filter((c) => !(c.x === x && c.y === y));
  take(g, track);
  g.pieces.push({ kind: 'path', cells: track }, { kind: 'gate', cells: [{ x, y }], dir: { x: east ? -1 : 1, y: 0 } });
}

/** Hedged beds either side of the way out of the garden door, where the ground behind the house allows. */
function parterre(g: Ground, garden: CellPoint | null): void {
  if (!garden) return;
  for (const side of [-1, 1]) {
    const bed = boxCells(box(garden.x + (side < 0 ? -4 : 2), garden.y - 3, 3, 1));
    if (bed.every((c) => free(g, c) && free(g, { x: c.x, y: c.y + 1 }) && free(g, { x: c.x, y: c.y - 1 }))) {
      take(g, bed);
      g.pieces.push({ kind: 'hedge', cells: bed });
    }
  }
}

/** Trees on the open lawn, two cells clear of what stands, one to every fifty cells of it. */
function trees(rng: Rng, g: Ground, lawn: readonly CellPoint[]): void {
  const clear = lawn.filter((c) => STEPS.every((s) => free(g, { x: c.x + s.x * 2, y: c.y + s.y * 2 }) && free(g, { x: c.x + s.x, y: c.y + s.y })));
  const count = Math.floor(lawn.length / 50);
  for (let k = 0; k < count && clear.length > 0; k++) {
    const c = clear.splice(int(rng, 0, clear.length - 1), 1)[0]!;
    if (!free(g, c)) continue;
    g.taken.add(cellKey(c.x, c.y));
    g.pieces.push({ kind: 'tree', cells: [c], at: { x: c.x + 0.5, y: c.y + 0.5 }, radius: 0.8 + rng() * 0.6 });
  }
}

/** The family crypt is the outbuilding farthest from the service yard: where the greenhouse came to lie farther, the two change uses. */
function farthestIsCrypt(pieces: GroundsPiece[], yard: Box): void {
  const d = (p: GroundsPiece): number => Math.hypot(p.cells[0]!.x - yard.x, p.cells[0]!.y - yard.y);
  const crypt = pieces.find((p) => p.use === 'crypt');
  const far = pieces.filter((p) => p.kind === 'outbuilding' && p.use !== 'carriage-house').sort((p, q) => d(q) - d(p))[0];
  if (crypt && far && far !== crypt) [crypt.use, far.use] = [far.use!, 'crypt'];
}

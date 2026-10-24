import { cellKey } from '../../../../src/app/dungeons/geometry';
import type { CellPoint, DungeonModel, GroundsPiece } from '../../../../src/app/dungeons/model';
import { SIDES, houseKeys } from './houseCells';

/** The grounds rules of a house (research §5.10, rules 7, 20 and 21), checked on a generated model alone. */

const keysOf = (pieces: readonly GroundsPiece[]): Set<string> => new Set(pieces.flatMap((p) => p.cells.map((c) => cellKey(c.x, c.y))));
const of = (model: DungeonModel, ...kinds: GroundsPiece['kind'][]): GroundsPiece[] => (model.floors[0]!.grounds?.pieces ?? []).filter((p) => kinds.includes(p.kind));

/** How many cells of lot lie before, beside and behind the house. */
export function lotMargins(model: DungeonModel): { front: number; side: number; back: number } {
  const lot = model.floors[0]!.grounds!.lot;
  const cells = [...houseKeys(model.floors[0]!)].map((k) => k.split(',').map(Number) as [number, number]);
  const x0 = Math.min(...cells.map(([x]) => x));
  const x1 = Math.max(...cells.map(([x]) => x));
  const y0 = Math.min(...cells.map(([, y]) => y));
  const y1 = Math.max(...cells.map(([, y]) => y));
  return { front: lot.y + lot.h - 1 - y1, side: Math.max(x0 - lot.x, lot.x + lot.w - 1 - x1), back: y0 - lot.y };
}

/** The lot holds the house. */
function lotHoldsHouse(model: DungeonModel): string[] {
  const lot = model.floors[0]!.grounds!.lot;
  const out = [...houseKeys(model.floors[0]!)].filter((k) => {
    const [x, y] = k.split(',').map(Number) as [number, number];
    return x < lot.x || y < lot.y || x >= lot.x + lot.w || y >= lot.y + lot.h;
  });
  return out.length ? [`${out.length} house cells off the lot`] : [];
}

/** 21. The boundary is closed but at its gates. */
function closedBoundary(model: DungeonModel): string[] {
  const lot = model.floors[0]!.grounds!.lot;
  const onEdge = (c: CellPoint): boolean => c.x === lot.x || c.y === lot.y || c.x === lot.x + lot.w - 1 || c.y === lot.y + lot.h - 1;
  const walls = of(model, 'boundary-wall', 'hedge').filter((p) => p.cells.some(onEdge));
  if (walls.length === 0) return [];
  const closed = keysOf([...walls, ...of(model, 'gate')]);
  const gaps: string[] = [];
  for (let x = lot.x; x < lot.x + lot.w; x++) for (const y of [lot.y, lot.y + lot.h - 1]) if (!closed.has(cellKey(x, y))) gaps.push(cellKey(x, y));
  for (let y = lot.y; y < lot.y + lot.h; y++) for (const x of [lot.x, lot.x + lot.w - 1]) if (!closed.has(cellKey(x, y))) gaps.push(cellKey(x, y));
  return gaps.length ? [`the boundary is open at ${gaps[0]}`] : [];
}

/** 7. The gate, the way in and the front door are one walk, two cells wide all the way. */
function wideWalkIn(model: DungeonModel): string[] {
  const gate = of(model, 'gate').find((g) => g.dir?.y === -1);
  const way = keysOf([...of(model, 'path', 'drive', 'porch'), ...(gate ? [gate] : [])]);
  const wide = (c: CellPoint): boolean => [0, -1].some((dx) => [0, -1].some((dy) => [0, 1].every((i) => [0, 1].every((j) => way.has(cellKey(c.x + dx + i, c.y + dy + j))))));
  const start = gate?.cells[0] ?? [...way].map((k) => k.split(',').map(Number) as [number, number]).map(([x, y]) => ({ x, y })).reduce((p, q) => (q.y > p.y ? q : p));
  if (!start) return ['no way in'];
  const seen = new Set([cellKey(start.x, start.y)]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const s of SIDES) {
      const next = { x: at.x + s.x, y: at.y + s.y };
      const key = cellKey(next.x, next.y);
      if (way.has(key) && wide(next) && !seen.has(key)) seen.add(key) && queue.push(next);
    }
  }
  return seen.has(cellKey(0, 0)) ? [] : ['the front door is not reached from the gate along a way two cells wide'];
}

/** 20. Outbuildings stand on the lot, off the house, each reached by a path; the crypt farthest from the service yard. */
function outbuildings(model: DungeonModel): string[] {
  const lot = model.floors[0]!.grounds!.lot;
  const house = houseKeys(model.floors[0]!);
  const paths = keysOf(of(model, 'path', 'drive'));
  const out: string[] = [];
  const buildings = of(model, 'outbuilding');
  for (const b of buildings) {
    if (b.cells.some((c) => house.has(cellKey(c.x, c.y)) || c.x < lot.x || c.y < lot.y || c.x >= lot.x + lot.w || c.y >= lot.y + lot.h)) out.push(`${b.use} off the lot or in the house`);
    if (!b.door || !paths.has(cellKey(b.door.x, b.door.y))) out.push(`${b.use} reached by no path`);
  }
  const yard = buildings.find((b) => b.use === 'carriage-house');
  const crypt = buildings.find((b) => b.use === 'crypt');
  if (yard && crypt) {
    const d = (b: GroundsPiece): number => Math.hypot(b.cells[0]!.x - yard.cells[0]!.x, b.cells[0]!.y - yard.cells[0]!.y);
    if (buildings.some((b) => b !== yard && d(b) > d(crypt))) out.push('the crypt is not the outbuilding farthest from the service yard');
  }
  return out;
}

/** Trees stand on the lawn, never on a path. */
function treesOnLawn(model: DungeonModel): string[] {
  const ways = keysOf(of(model, 'path', 'drive', 'porch', 'gate'));
  return of(model, 'tree').filter((t) => t.cells.some((c) => ways.has(cellKey(c.x, c.y)))).map((t) => `a tree on a path at ${t.cells[0]!.x},${t.cells[0]!.y}`);
}

export const groundsRules = { lotHoldsHouse, closedBoundary, wideWalkIn, outbuildings, treesOnLawn };

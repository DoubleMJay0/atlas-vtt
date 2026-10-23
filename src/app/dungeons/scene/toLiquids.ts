import { toGameUnits } from '../../grid/statedDistance';
import type { MeasurementSettings } from '../../grid/measurementFormat';
import { MAX_AREA_CORNERS } from '../../lighting/lightArea';
import type { LightEmission, LightSource } from '../../types/lightingTypes';
import type { LiquidColors, LiquidKind, LiquidSurface } from '../../types/liquidTypes';
import type { CellPoint, DungeonColumn, DungeonTerrain } from '../model';
import { intersectRings, subtractRings, unionRings } from '../render/clipShapes';
import { shapePolygon, type Vec } from '../render/geometry';
import { mixColours, paletteOf } from '../render/palette';
import type { VisibleDungeon } from '../render/visibleDungeon';
import type { DungeonStyle, DungeonView } from '../style';
import { propPolygon } from './toFeatures';
import { waterColours } from './waterColours';
import type { DungeonPlacement } from './toWalls';

/**
 * What a floor's water, lava and acid bring to its scene: a surface that moves while maps are
 * animated (`objects.liquids`) on exactly what the map paints of it, and for lava and acid a light
 * that glows from the whole of that surface (`LightSource.area`), so a room with lava is lit by it.
 */

/** The most corners an outline gets: as many as an area light reads; a larger one is simplified (`fitCorners`). */
const MAX_CORNERS = MAX_AREA_CORNERS;
/** How far a simplified outline may stray from the drawn one at first, in cells; doubled until it fits. */
const FIRST_TOLERANCE = 0.01;

interface Liquid {
  liquid: LiquidKind;
  /** Its outline in cells. */
  ring: Vec[];
  /** Islands and what stands in it, in cells. */
  holes?: Vec[][];
  flow?: Vec;
}

/** The closed curve `traceSmoothClosed` draws through a pool's corners, as points `steps` to a corner. */
function smoothRing(points: readonly Vec[], steps: number): Vec[] {
  const n = points.length;
  const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const from = mid(points[(i + n - 1) % n]!, points[i]!);
    const control = points[i]!;
    const to = mid(control, points[(i + 1) % n]!);
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      out.push({ x: u * u * from.x + 2 * u * t * control.x + t * t * to.x, y: u * u * from.y + 2 * u * t * control.y + t * t * to.y });
    }
  }
  return out;
}

/** What each hazard on the floor holds, if it is a liquid. */
const HAZARD_LIQUID: Readonly<Partial<Record<string, LiquidKind>>> = { lava: 'lava', acid: 'acid', 'deep-water': 'water' };

function terrainLiquids(pieces: readonly DungeonTerrain[]): Liquid[] {
  return pieces.flatMap(piece => {
    const liquid = piece.traits.hazard && HAZARD_LIQUID[piece.traits.hazard];
    if (!liquid || (piece.kind !== 'channel' && piece.kind !== 'deep-water')) return [];
    const flow = piece.kind === 'channel' && piece.facing ? { x: piece.facing.x, y: piece.facing.y } : undefined;
    return withHoles(cellRings(piece.cells)).map(({ ring, holes }): Liquid => ({ liquid, ring, ...(holes.length && { holes }), ...(flow && { flow }) }));
  });
}

/** The outline of cells as clipping makes it: whole rings with their holes, never a ring per row. */
function cellRings(cells: readonly CellPoint[]): Vec[][] {
  return unionRings(cells.map(({ x, y }) => [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 }]));
}

/** Points of a closed ring kept by Douglas–Peucker within `tolerance`. */
function simplifyRing(ring: readonly Vec[], tolerance: number): Vec[] {
  const keep = new Uint8Array(ring.length);
  const stack: [number, number][] = [[0, Math.floor(ring.length / 2)], [Math.floor(ring.length / 2), ring.length]];
  keep[0] = 1;
  keep[Math.floor(ring.length / 2)] = 1;
  while (stack.length) {
    const [from, to] = stack.pop()!;
    const a = ring[from]!;
    const b = ring[to % ring.length]!;
    let far = -1;
    let farthest = tolerance;
    for (let i = from + 1; i < to; i++) {
      const d = segmentDistance(ring[i]!, a, b);
      if (d > farthest) {
        farthest = d;
        far = i;
      }
    }
    if (far < 0) continue;
    keep[far] = 1;
    stack.push([from, far], [far, to]);
  }
  return ring.filter((_, i) => keep[i]);
}

function segmentDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** A ring within `MAX_CORNERS`: as drawn where it fits, else simplified as little as it takes. */
function fitCorners(ring: Vec[]): Vec[] {
  let fitted = ring;
  for (let tolerance = FIRST_TOLERANCE; fitted.length > MAX_CORNERS; tolerance *= 2) fitted = simplifyRing(ring, tolerance);
  return fitted;
}

/** The outline of a standing column, which the water flows round. */
function columnRing({ x, y, radius, square }: DungeonColumn): Vec[] {
  if (square) return [{ x: x - radius, y: y - radius }, { x: x + radius, y: y - radius }, { x: x + radius, y: y + radius }, { x: x - radius, y: y + radius }];
  return Array.from({ length: 16 }, (_, k) => ({ x: x + Math.cos((k / 16) * Math.PI * 2) * radius, y: y + Math.sin((k / 16) * Math.PI * 2) * radius }));
}

/** Rings as clipping gives them back, outlines with the holes that lie in each. */
function withHoles(rings: Vec[][]): { ring: Vec[]; holes: Vec[][] }[] {
  const outlines = rings.filter(ring => signedArea(ring) > 0);
  const holes = rings.filter(ring => signedArea(ring) < 0);
  return outlines.map(ring => ({ ring, holes: holes.filter(hole => inside(ring, hole[0]!)) }));
}

/** The floor's pools of water, on what of them lies on the floor (the map clips them there too). Lava and acid are hazards of their own, never pools. */
function poolLiquids(dungeon: VisibleDungeon): Liquid[] {
  const floorRings = unionRings(dungeon.floors.map(shape => shapePolygon(shape, 0, 100)));
  return dungeon.floor.water.flatMap(pool => {
    return withHoles(intersectRings([smoothRing(pool.outline, 4)], floorRings)).map(({ ring, holes }): Liquid => ({ liquid: 'water', ring, ...(holes.length && { holes }) }));
  });
}

/** Terrain that is part of the water itself, not drawn over it. */
const UNDER_WATER: ReadonlySet<string> = new Set(['shallow-water']);

/**
 * What the map draws over its water: stairwells, every piece of terrain that is no liquid (bridges
 * among them), furniture and columns. Cut out of the surfaces, so the motion never runs over them.
 */
function drawnOver(dungeon: VisibleDungeon, view: DungeonView): Vec[][] {
  const { floor, roomShapes } = dungeon;
  const stairs = floor.stairs.map(({ x, y, w, h }) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]);
  const terrain = floor.terrain
    .filter(piece => roomShapes.has(piece.room) && !UNDER_WATER.has(piece.kind) && !(piece.traits.hazard && HAZARD_LIQUID[piece.traits.hazard]))
    .flatMap(piece => cellRings(piece.cells));
  const props = view.props ? floor.props.filter(prop => roomShapes.has(prop.room)).map(propPolygon) : [];
  return [...stairs, ...terrain, ...props, ...floor.columns.map(columnRing)];
}

/** Each liquid with what the map draws over it cut out: islands as holes, a surface cut in two as two, every ring within `MAX_CORNERS`. */
function cutOut(found: readonly Liquid[], over: readonly Vec[][]): Liquid[] {
  return found.flatMap(({ ring, holes = [], ...rest }) =>
    withHoles(over.length ? subtractRings([ring, ...holes], over) : [ring, ...holes])
      .filter(cut => cut.ring.length >= 3 && signedArea(cut.ring) > 0.05)
      .map((cut): Liquid => ({ ...rest, ring: fitCorners(cut.ring), ...(cut.holes.length && { holes: cut.holes.map(fitCorners) }) })));
}

/** Positive for an outline, negative for a hole, as clipping orients them. */
function signedArea(ring: readonly Vec[]): number {
  let sum = 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    sum += p.x * q.y - q.x * p.y;
  });
  return sum / 2;
}

function inside(polygon: readonly Vec[], p: Vec): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The middle of an outline, by area. */
function centroid(ring: readonly Vec[]): Vec {
  let a = 0;
  let cx = 0;
  let cy = 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  });
  return a === 0 ? ring[0]! : { x: cx / (3 * a), y: cy / (3 * a) };
}

/** The colours each liquid moves in, from the look's own: water in the look's water, lava and acid in theirs, toned down to the duotone of a monochrome map. */
function liquidColours(style: DungeonStyle, view: DungeonView): Record<LiquidKind, LiquidColors> {
  const palette = paletteOf(style, view);
  const water = waterColours(style, view);
  if (view.monochrome) {
    const mono = { surface: palette.water, deep: mixColours(palette.water, palette.ink, 0.35), glint: mixColours(palette.water, '#ffffff', 0.75) };
    return { water, lava: mono, acid: mono };
  }
  return {
    water,
    lava: { surface: '#d6602a', deep: '#5c1a0c', glint: '#ffd27a' },
    acid: { surface: '#86b43a', deep: '#3a4e1a', glint: '#d8f59a' },
  };
}

/** How lava and acid glow, in cells: lava lights its room, acid only its shore. */
const GLOWS: Readonly<Partial<Record<LiquidKind, { bright: number; dim: number; color: string; intensity: number }>>> = {
  lava: { bright: 1, dim: 4, color: '#ff8a3d', intensity: 1 },
  acid: { bright: 0, dim: 1.5, color: '#9be05a', intensity: 0.5 },
};

export interface FloorLiquids {
  liquids: Record<string, LiquidSurface>;
  lights: Record<string, LightSource>;
}

/**
 * The floor's liquids as surfaces of its level, and a glowing light over each lava and acid, its
 * ranges in the collection's units (`unit`; a cell of the dungeon is two squares with small tiles).
 */
export function floorLiquids(
  dungeon: VisibleDungeon,
  style: DungeonStyle,
  view: DungeonView,
  placement: DungeonPlacement,
  unit: Pick<MeasurementSettings, 'unitType' | 'ruleDistance'>,
  id: string,
  level?: string,
): FloorLiquids {
  const shown = dungeon.floor.terrain.filter(piece => dungeon.roomShapes.has(piece.room));
  const whole = [...(view.water ? poolLiquids(dungeon) : []), ...terrainLiquids(shown)];
  const colours = liquidColours(style, view);
  const { originCell, pxPerCell } = placement;
  const world = (p: Vec): Vec => ({ x: (p.x - originCell.x) * pxPerCell, y: (p.y - originCell.y) * pxPerCell });
  const squares = view.smallTiles ? 2 : 1;
  const units = (cells: number): number => toGameUnits({ value: cells * squares, unit: 'squares' }, { unitType: unit.unitType, ruleDistance: unit.ruleDistance });
  const liquids: Record<string, LiquidSurface> = {};
  cutOut(whole, drawnOver(dungeon, view)).forEach(({ liquid, ring, holes, flow }, index) => {
    const liquidId = `liquid_${id}_${index + 1}`;
    liquids[liquidId] = { id: liquidId, kind: 'liquid', liquid, polygon: ring.map(world), ...(holes && { holes: holes.map(hole => hole.map(world)) }), ...(flow && { flow }), colors: colours[liquid], ...(liquid === 'water' && { waterStyle: style.direction === 'engraved' ? 'engraved' : 'painted' }), ...(level && { level }) };
  });
  // The glow comes from the whole of the lava, under its bridges and what stands in it too
  const lights: Record<string, LightSource> = {};
  whole.forEach(({ liquid, ring }, index) => {
    const glow = GLOWS[liquid];
    if (!glow) return;
    const area = fitCorners(ring).map(world);
    const middle = centroid(area);
    const emission: LightEmission = { bright: units(glow.bright), dim: units(glow.dim), color: glow.color, intensity: glow.intensity, animation: 'smoulder', kind: 'custom' };
    const lightId = `light_${id}_${index + 1}`;
    lights[lightId] = { id: lightId, kind: 'light', x: middle.x, y: middle.y, emission, area, ...(level && { levels: [level] }) };
  });
  return { liquids, lights };
}


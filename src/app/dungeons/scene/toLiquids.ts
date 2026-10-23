import { toGameUnits } from '../../grid/statedDistance';
import type { MeasurementSettings } from '../../grid/measurementFormat';
import type { LightEmission, LightSource } from '../../types/lightingTypes';
import type { LiquidColors, LiquidKind, LiquidSurface } from '../../types/liquidTypes';
import type { DungeonTerrain } from '../model';
import { intersectRings, unionRings } from '../render/clipShapes';
import { shapePolygon, type Vec } from '../render/geometry';
import { mixColours, paletteOf } from '../render/palette';
import type { VisibleDungeon } from '../render/visibleDungeon';
import type { DungeonStyle, DungeonView } from '../style';
import { cellOutlines } from './cellOutline';
import type { DungeonPlacement } from './toWalls';

/**
 * What a floor's water, lava and acid bring to its scene: a surface that moves while maps are
 * animated (`objects.liquids`) on exactly what the map paints of it, and for lava and acid a light
 * that glows from the whole of that surface (`LightSource.area`), so a room with lava is lit by it.
 */

/** The most corners a surface's outline gets; a pool's curve is sampled more coarsely to stay under it. */
const MAX_CORNERS = 128;

interface Liquid {
  liquid: LiquidKind;
  /** Its outline in cells. */
  ring: Vec[];
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
    return cellOutlines(piece.cells, MAX_CORNERS).map((ring): Liquid => ({ liquid, ring, ...(flow && { flow }) }));
  });
}

/** The floor's pools, on what of them lies on the floor (the map clips them there too). */
function poolLiquids(dungeon: VisibleDungeon, style: DungeonStyle): Liquid[] {
  const floorRings = unionRings(dungeon.floors.map(shape => shapePolygon(shape, 0, 100)));
  const liquid: LiquidKind = style.liquid === 'lava' ? 'lava' : 'water';
  return dungeon.floor.water.flatMap(pool => {
    const steps = Math.max(1, Math.min(6, Math.floor(MAX_CORNERS / Math.max(3, pool.outline.length))));
    return intersectRings([smoothRing(pool.outline, steps)], floorRings)
      .filter(ring => ring.length >= 3 && ring.length <= MAX_CORNERS && signedArea(ring) > 0.05)
      .map((ring): Liquid => ({ liquid, ring }));
  });
}

function signedArea(ring: readonly Vec[]): number {
  let sum = 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    sum += p.x * q.y - q.x * p.y;
  });
  return Math.abs(sum / 2);
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
  const water: LiquidColors = { surface: palette.water, deep: mixColours(palette.water, palette.ink, 0.35), glint: mixColours(palette.water, '#ffffff', 0.75) };
  if (view.monochrome) return { water, lava: water, acid: water };
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
  const found = [...(view.water ? poolLiquids(dungeon, style) : []), ...terrainLiquids(shown)];
  const colours = liquidColours(style, view);
  const { originCell, pxPerCell } = placement;
  const world = (p: Vec): Vec => ({ x: (p.x - originCell.x) * pxPerCell, y: (p.y - originCell.y) * pxPerCell });
  const squares = view.smallTiles ? 2 : 1;
  const units = (cells: number): number => toGameUnits({ value: cells * squares, unit: 'squares' }, { unitType: unit.unitType, ruleDistance: unit.ruleDistance });
  const liquids: Record<string, LiquidSurface> = {};
  const lights: Record<string, LightSource> = {};
  found.forEach(({ liquid, ring, flow }, index) => {
    const polygon = ring.map(world);
    const liquidId = `liquid_${id}_${index + 1}`;
    liquids[liquidId] = { id: liquidId, kind: 'liquid', liquid, polygon, ...(flow && { flow }), colors: colours[liquid], ...(level && { level }) };
    const glow = GLOWS[liquid];
    if (!glow) return;
    const middle = centroid(polygon);
    const emission: LightEmission = { bright: units(glow.bright), dim: units(glow.dim), color: glow.color, intensity: glow.intensity, animation: 'pulse', kind: 'custom' };
    const lightId = `light_${id}_${index + 1}`;
    lights[lightId] = { id: lightId, kind: 'light', x: middle.x, y: middle.y, emission, area: polygon, ...(level && { levels: [level] }) };
  });
  return { liquids, lights };
}


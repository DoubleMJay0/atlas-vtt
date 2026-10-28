import type { ArtScene } from '../art/artScene';
import { viewBounds } from '../art/artScene';
import { drawPassages } from '../art/passages';
import { drawProps } from '../art/drawProps';
import { castShadow, type Hand } from '../art/hand';
import { polysPath, rectPoly, type Field, type PathFn } from '../art/paths';
import { clipOutBuiltWater, deepnessField, depthField, poolOutlines, poolShores } from '../art/pools';
import { grownRings, intersectRings, subtractRings, unionRings } from '../clipShapes';
import { floorWater, riverBars, riverIslands, waterField } from '../../forest/riverShape';
import { bridgeApproaches, bridgeSpan, drawRiverBridges } from './riverBridges';
import { pointSegmentDistance, pointsBounds, tracePolygon, traceShapes, type Vec } from '../geometry';
import { wayCentre, wayFrameOf, wayHalf, type WayOut } from '../cave/mouth/wayOut';
import { drawGrid } from '../grid';
import type { GroundsPaint } from '../grounds/paint';
import { drawTerrainGround, drawTerrainOpenings, drawTerrainStanding } from '../terrain/drawTerrain';
import { leafyMass } from '../grounds/crowns';
import { loneTrees } from './loneTrees';
import { trailFade, trailRing } from './trails';
import { MASS_DEPTH, woodsMass, type WoodsClump } from './woodsMass';

/** What a direction brings to a forest floor: its hand and ground, the woods' colour, each clump of the mass and what it lays over the whole mass, its water. */
export interface ForestArt {
  hand: Hand;
  ground: GroundsPaint;
  colours: { water: string; cloth: string };
  woods(): void;
  /** A trail's worn ground over `path`, as strong as `fade` says where it lies (0..1). */
  trail(path: PathFn, fade: (p: Vec) => number): void;
  clump(entry: WoodsClump): void;
  /** `depth`: how far into the mass a point lies, 0 at a clearing's or trail's edge to 1 at its depth. */
  finish(mass: readonly WoodsClump[], depth: (x: number, y: number) => number): void;
  /** The floor's water within `trace` (shores `outlines`), as the direction draws a pool; `scene`'s floor holds the water. */
  water(scene: ArtScene, trace: PathFn, outlines: readonly Vec[][], depth: Field, deepness: Field): void;
}

/** How far the mass keeps off a river's water, in cells: the trees stand on its banks and lean over it a little. */
const RIVER_BANK = 0.3;
/** How far the mass keeps off a bridge's middle line, in cells: the deck and a little either side. */
const BRIDGE_CLEAR = 0.7;

/**
 * A Forest's entry floor, as Watabou's Glade view and Reprieve draw woods, bottom to top: the woods'
 * colour over the whole frame, the clearings' ground (running on under the woods' mass, so a gap in
 * it shows ground and never the outline), water and terrain on the ground, one merged shadow of the
 * mass, the grid, the mass of leafy clumps from the deepest to the clearing's edge (its silhouette is
 * the clearing's edge), then what stands in the clearings and the ways down to the caves.
 */
export function drawForest(scene: ArtScene, art: ForestArt): void {
  const { hand } = art;
  const view = viewBounds(scene.frame, 1);
  const { dungeon } = scene.env;
  const trails = dungeon.ways.map(trailRing);
  const { rivers = [], lakes } = dungeon.floor;
  const riverWater = floorWater(rivers, lakes);
  // The ground runs on under the mass along a river and round a lake as along a clearing.
  const banks = riverWater.length ? grownRings(riverWater, MASS_DEPTH) : [];
  const ground = (path: CanvasPath): void => {
    traceShapes(path, scene.floors, MASS_DEPTH, MASS_DEPTH);
    for (const ring of trails) tracePolygon(path, ring);
    for (const ring of banks) tracePolygon(path, ring);
  };
  // The trails and rivers run through the woods: the mass keeps off them as off a clearing.
  // The mass overhangs a trail's sides a little, so the woods' colour never shows between them.
  // Asked a few million times: no allocation in it.
  const field = waterField(rivers, lakes);
  // The bridges, with worn paths onto the ends no trail reaches: the woods keep off them too.
  const bridges = scene.env.view.water ? rivers.flatMap((river) => river.bridges) : [];
  const onTrail = (p: Vec): boolean => dungeon.ways.some((way) => trailDistance(way, p) < 0.3);
  const approaches = bridgeApproaches(bridges, onTrail);
  const spans = bridges.map((bridge) => bridgeSpan(bridge, onTrail));
  const outsideAt = (x: number, y: number): number => {
    let best = Math.min(scene.sdfAt(x, y), field.distance(x, y) - RIVER_BANK);
    for (const way of dungeon.ways) best = Math.min(best, trailDistance(way, { x, y }) + TRAIL_OVERHANG);
    for (const [a, b] of spans) best = Math.min(best, pointSegmentDistance({ x, y }, a, b) - BRIDGE_CLEAR);
    return best;
  };
  // The woods first and the ground over them, never the woods cut out of the frame: an even-odd cut turns back where two clearings' reaches overlap.
  art.woods();
  art.ground.lawn(ground, cellsOf(view));
  // Each trail worn into the ground, fading where it leaves into the woods.
  for (const [k, way] of dungeon.ways.entries()) art.trail(polysPath([trails[k]!]), (p) => trailFade(way, wayFrameOf(way, p).u));
  for (const { ring, fade } of approaches) art.trail(polysPath([ring]), fade);
  const drawn = scene.env.view.water ? drawWater(scene, art, riverWater, field) : riverWater;
  // The bars on the insides of the bends, where no other water (a pool, another river) lies over them, and the islands.
  const bars = riverWater.length ? [...subtractRings(rivers.flatMap(riverBars), drawn), ...riverIslands(rivers)] : [];
  if (bars.length) art.ground.gravel(polysPath(bars), cellsOf(pointsBounds(bars.flat())));
  drawTerrainGround(hand, art.colours);
  const mass = woodsMass(view, (p) => outsideAt(p.x, p.y), dungeon.model.seed);
  const rings = [...mass.map((entry) => entry.clump.ring), ...loneTrees(scene.env.dungeon).map((tree) => discRing(tree.x, tree.y, tree.radius))];
  if (rings.length) castShadow(hand, polysPath(rings), 0.55, pointsBounds(rings.flat()), art.ground.shade.tree, ground);
  drawGrid(scene.env);
  for (const entry of mass) art.clump(entry);
  const depth = (x: number, y: number): number => massShare(outsideAt(x, y));
  art.finish(mass, depth);
  // The lone trees in the clearings, drawn as the mass's edge is, each a crown of its own.
  const lone = loneTrees(scene.env.dungeon).map((tree): WoodsClump => ({ clump: leafyMass({ x: tree.x, y: tree.y }, tree.radius, 0, Math.floor(tree.x * 7349 + tree.y * 3083), 15), depth: 0 }));
  for (const entry of lone) art.clump(entry);
  art.finish(lone, () => 0);
  drawRiverBridges(hand, bridges);
  drawProps(hand, art.colours.water, art.colours.cloth);
  drawTerrainStanding(hand, art.colours);
  drawPassages(hand);
  drawTerrainOpenings(hand);
}

/** How far the notches where a pool meets a river are rounded, in cells. */
const SHORE_WEAR = 0.35;

/** How far past the frame the water is painted, in cells: its depth near the frame is its own, never that of a shore the cut makes. */
const WATER_MARGIN = 3;

/**
 * The floor's pools, rivers and lakes as one water (returned as drawn), painted together as the direction paints a
 * pool, so no shore crosses another's water: off the floor's built water, as far as the picture
 * reaches. A river or lake is deep where it lies far from its shores; a pool where the cave's deep
 * water lies.
 */
function drawWater(scene: ArtScene, art: ForestArt, riverWater: readonly Vec[][], field: { distance(x: number, y: number): number }): Vec[][] {
  const pools = poolShores(poolOutlines(scene));
  if (!pools.length && !riverWater.length) return [];
  const b = viewBounds(scene.frame, WATER_MARGIN);
  const joined = unionRings([...riverWater, ...pools]);
  // Where a pool meets a river or a lake their shores meet at a sharp notch: rounded as water would wear it.
  const worn = riverWater.length && pools.length ? grownRings(grownRings(joined, SHORE_WEAR), -SHORE_WEAR) : joined;
  const water = intersectRings(worn, [rectPoly({ x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY })]);
  if (!water.length) return [];
  const trace = polysPath(water);
  // The painters clip to the floor, which a river or a lake leaves for the woods.
  const waterScene: ArtScene = riverWater.length ? { ...scene, floorRings: unionRings([...scene.floorRings, ...water]) } : scene;
  const depth = depthField(waterScene, trace, water.flat());
  const caveDeep = deepnessField(scene);
  const deepness: Field = (x, y) => Math.max(caveDeep?.(x, y) ?? 0, field.distance(x, y) < 0 ? Math.max(0, Math.min(1, (depth(x, y) - 0.8) / 0.9)) : 0);
  const { ctx } = scene.env;
  ctx.save();
  clipOutBuiltWater(scene, ctx);
  art.water(waterScene, trace, water, depth, deepness);
  ctx.restore();
  return water;
}

/** How far the mass reaches over a trail's sides, in cells. */
const TRAIL_OVERHANG = 0.1;

/** How far a clump stands into the mass, 0 at the clearing to 1 at its depth. */
export function massShare(depth: number): number {
  return Math.max(0, Math.min(1, depth / MASS_DEPTH));
}

function cellsOf(bounds: { minX: number; minY: number; maxX: number; maxY: number }): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = Math.floor(bounds.minY); y < bounds.maxY; y++) for (let x = Math.floor(bounds.minX); x < bounds.maxX; x++) cells.push({ x, y });
  return cells;
}

/** A circle's outline as a ring of points, for a lone tree's shadow. */
function discRing(x: number, y: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: 16 }, (_, k) => ({ x: x + r * Math.cos((k * Math.PI) / 8), y: y + r * Math.sin((k * Math.PI) / 8) }));
}

/** How far `p` lies outside a trail, in cells (negative on it): beside its middle line, between its mouth and its far end. */
function trailDistance(way: WayOut, p: Vec): number {
  const { u, v } = wayFrameOf(way, p);
  if (u < -0.5 || u > way.length + 0.5) return Infinity;
  const off = v - wayCentre(way, u);
  return Math.abs(off) - wayHalf(way, u, Math.sign(off) || 1);
}


import type { ArtScene } from '../art/artScene';
import { viewBounds } from '../art/artScene';
import { drawPassages } from '../art/passages';
import { drawProps } from '../art/drawProps';
import { castShadow, type Hand } from '../art/hand';
import { polysPath, type PathFn } from '../art/paths';
import { pointsBounds, tracePolygon, traceShapes, type Vec } from '../geometry';
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
  pools(): void;
}

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
  const ground = (path: CanvasPath): void => {
    traceShapes(path, scene.floors, MASS_DEPTH, MASS_DEPTH);
    for (const ring of trails) tracePolygon(path, ring);
  };
  // The trails leave the clearings through the woods: the mass keeps off them as off a clearing.
  // The mass overhangs a trail's sides a little, so the woods' colour never shows between them.
  const outside = (p: Vec): number => Math.min(scene.sdfAt(p.x, p.y), ...dungeon.ways.map((way) => trailDistance(way, p) + TRAIL_OVERHANG));
  // The woods first and the ground over them, never the woods cut out of the frame: an even-odd cut turns back where two clearings' reaches overlap.
  art.woods();
  art.ground.lawn(ground, cellsOf(view));
  // Each trail worn into the ground, fading where it leaves into the woods.
  for (const [k, way] of dungeon.ways.entries()) art.trail(polysPath([trails[k]!]), (p) => trailFade(way, wayFrameOf(way, p).u));
  art.pools();
  drawTerrainGround(hand, art.colours);
  const mass = woodsMass(view, outside, dungeon.model.seed);
  const rings = [...mass.map((entry) => entry.clump.ring), ...loneTrees(scene.env.dungeon).map((tree) => discRing(tree.x, tree.y, tree.radius))];
  if (rings.length) castShadow(hand, polysPath(rings), 0.55, pointsBounds(rings.flat()), art.ground.shade.tree, ground);
  drawGrid(scene.env);
  for (const entry of mass) art.clump(entry);
  const depth = (x: number, y: number): number => massShare(outside({ x, y }));
  art.finish(mass, depth);
  // The lone trees in the clearings, drawn as the mass's edge is, each a crown of its own.
  const lone = loneTrees(scene.env.dungeon).map((tree): WoodsClump => ({ clump: leafyMass({ x: tree.x, y: tree.y }, tree.radius, 0, Math.floor(tree.x * 7349 + tree.y * 3083), 15), depth: 0 }));
  for (const entry of lone) art.clump(entry);
  art.finish(lone, () => 0);
  drawProps(hand, art.colours.water, art.colours.cloth);
  drawTerrainStanding(hand, art.colours);
  drawPassages(hand);
  drawTerrainOpenings(hand);
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


import type { DungeonTerrain } from '../../model';
import { pointsBounds, type Vec } from '../geometry';
import { castShadow, type Hand } from '../art/hand';
import { polysPath, smoothstep } from '../art/paths';
import { drawField, fieldOf, gridOver } from '../art/raster';
import { cellRings, edgesFacing, type CellEdge } from './cellRings';
import { drawDrop, dropDepth, dropTone, FACE } from './drops';
import { cellSet, cutsHoles, isHole, onFloor, shownPieces } from './pieces';
import { chiselled } from './stones';

/**
 * Holes in the floor: chasms, shafts and the well of a gallery. Where a floor lies below, the hole
 * is cut out of the picture inside a narrow rock face, so the scene shows the level below through
 * it; on the deepest floor, and where a picture stands alone (the SVG export), it is painted as
 * depth. A gallery's rim carries a hollow balustrade on the floor round it.
 */

/** The face a cut hole keeps before it opens onto the level below, in cells. */
const CUT_FACE = 0.2;

/** A hole's outline: chiselled rock, or the straight edges of a built well. */
export function holeRings(piece: DungeonTerrain): Vec[][] {
  const rings = cellRings(piece.cells);
  return piece.kind === 'gallery' ? rings : rings.map(r => chiselled(r, piece.id * 13 + 5, 0.035));
}

export function drawHoles(hand: Hand): void {
  const { env } = hand.scene;
  const holes = shownPieces(env).filter(isHole);
  if (!holes.length) return;
  const cut = cutsHoles(env);
  // A cave's wall may wander into a hole's cells: the hole opens only the floor, never the wall drawn round it.
  const cave = env.dungeon.floor.cave !== undefined;
  if (cave) {
    env.ctx.save();
    env.ctx.beginPath();
    polysPath(hand.scene.floorRings)(env.ctx);
    env.ctx.clip();
  }
  for (const hole of holes) {
    if (hole.kind === 'gallery') balustrade(hand, edgesFacing(hole.cells, c => !cellSet(hole.cells).has(`${c.x},${c.y}`) && onFloor(env, c)));
    const rings = holeRings(hole);
    if (cut) cutHole(hand, rings, hole.kind === 'gallery');
    else drawDrop(hand, rings, hole.opening?.bottom === null || env.dungeon.index === env.dungeon.model.floors.length - 1 ? 'void' : 'floor', hole.kind === 'gallery');
  }
  if (cave) env.ctx.restore();
}

/** A hole over a floor below: its lip and a narrow face, then nothing, so the level below shows. */
function cutHole(hand: Hand, rings: Vec[][], built: boolean): void {
  const { scene } = hand;
  const path = polysPath(rings);
  const b = pointsBounds(rings.flat());
  const bounds = { minX: b.minX - 0.1, minY: b.minY - 0.1, maxX: b.maxX + 0.1, maxY: b.maxY + 0.1 };
  const { depth, inward } = dropDepth(hand, rings);
  hand.surface(path, built ? 'dressed' : 'rock');
  const tone = dropTone(depth, inward, 'void');
  hand.tone((x, y) => tone(x, y) * (FACE.void / CUT_FACE) ** 0.3, bounds, path, 'depth');
  const { ctx } = scene.env;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  if (scene.raster) {
    const grid = gridOver(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, scene.grid.res);
    drawField(ctx, grid, [0, 0, 0], fieldOf(grid, (x, y) => smoothstep(CUT_FACE, CUT_FACE + 0.05, depth(x, y))));
  } else {
    ctx.beginPath();
    path(ctx);
    ctx.fill();
  }
  ctx.restore();
  for (const ring of rings) hand.edges(ring, false);
}

/** A balustrade along a gallery's rim where it meets floor: a hollow rail on posts, standing on the floor beside the well. */
function balustrade(hand: Hand, edges: readonly CellEdge[]): void {
  const rails: Vec[][] = [];
  const posts: Vec[][] = [];
  for (const e of edges) {
    const d = { x: e.to.x - e.from.x, y: e.to.y - e.from.y };
    const len = Math.hypot(d.x, d.y);
    // Outwards is on the left of the way along the edge: the well lies on its right.
    const out = { x: d.y / len, y: -d.x / len };
    const at = (u: number, o: number): Vec => ({ x: e.from.x + (d.x * u) / len + out.x * o, y: e.from.y + (d.y * u) / len + out.y * o });
    rails.push([at(0, 0.035), at(len, 0.035), at(len, 0.115), at(0, 0.115)]);
    const n = Math.max(2, Math.round(len / 0.25));
    for (let k = 0; k <= n; k++) {
      const u = (len * k) / n;
      posts.push([at(u - 0.04, 0.035), at(u + 0.04, 0.035), at(u + 0.04, 0.115), at(u - 0.04, 0.115)]);
    }
  }
  if (!rails.length) return;
  const b = pointsBounds(rails.flat());
  castShadow(hand, polysPath(posts), 0.12, b, 0.6);
  hand.surface(polysPath(posts), 'dressed');
  for (const p of posts) hand.edges(p, true);
  hand.line(rails.map(r => [r[0]!, r[1]!]), 'outline');
  hand.line(rails.map(r => [r[3]!, r[2]!]), 'outline');
}

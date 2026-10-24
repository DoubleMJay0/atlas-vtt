import { rngFrom } from '../../../rng';
import { viewBounds, type ArtScene } from '../../art/artScene';
import { shadeEdges, TO_LIGHT } from '../../art/light';
import { mouthLane, mouthsOf } from '../../art/mouths';
import { hash2 } from '../../art/noise';
import { traceRings } from '../../art/outline';
import { polyPath, runsPath } from '../../art/paths';
import type { Pens } from '../../engraved/pens';
import type { Vec } from '../../geometry';
import { mixColours, withAlpha } from '../../palette';
import { narrowPockets } from '../../pockets';
import { strokeWidth } from '../../renderEnv';
import { stoneOutline } from '../../terrain/stones';
import type { StoneColours } from '../../stone/colours';
import { stoneHand } from '../../stone/hand';

function clipLanes(scene: ArtScene): void {
  const { ctx, dungeon } = scene.env;
  const mouths = mouthsOf(dungeon);
  if (!mouths.length) return;
  const b = viewBounds(scene.frame, 10);
  ctx.beginPath();
  ctx.rect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
  // The same lane as the built surround's: rock never closes an entrance's two-cell mouth.
  for (const mouth of mouths) polyPath(mouthLane(mouth))(ctx);
  ctx.clip('evenodd');
}

/** Loose fracture slabs, keyed to map coordinates, with neither courses nor a room seam. */
function slabs(scene: ArtScene): Vec[][] {
  const { dungeon, style } = scene.env;
  const seed = dungeon.model.seed + dungeon.index * 101;
  const size = Math.max(0.16, style.surround.size);
  const step = size * 0.85;
  const reach = style.surround.reach;
  const b = viewBounds(scene.frame, reach + size);
  const out: Vec[][] = [];
  for (let j = Math.floor(b.minY / step); j <= b.maxY / step; j++) {
    for (let i = Math.floor(b.minX / step); i <= b.maxX / step; i++) {
      const x = (i + hash2(i, j, seed + 31)) * step;
      const y = (j + hash2(i, j, seed + 32)) * step;
      const distance = dungeon.field.distance(x, y);
      if (distance < -size * 0.5 || distance > reach * 0.65) continue;
      const radius = size * (0.42 + hash2(i, j, seed + 33) * 0.3);
      const rng = rngFrom(Math.floor(hash2(i, j, seed + 34) * 0xffffffff));
      const poly = stoneOutline(rng, { x, y }, radius);
      // Keep the look's reach, breaking off whole slabs at its outside, never a ruled border.
      if (poly.some(p => dungeon.field.distance(p.x, p.y) > reach)) continue;
      out.push(poly);
    }
  }
  return out;
}

function fillPockets(scene: ArtScene, colour: string): void {
  const { ctx, dungeon, style } = scene.env;
  ctx.beginPath();
  traceRings(ctx, narrowPockets(dungeon, style.surround.reach).map(pocket => pocket.ring));
  ctx.fillStyle = colour;
  ctx.fill();
}

function strokeFracture(scene: ArtScene, poly: Vec[], colour: string, width: number): void {
  const { ctx } = scene.env;
  const a = poly[1]!;
  const b = poly[4]!;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(a.x * 0.4 + b.x * 0.6, a.y * 0.65 + b.y * 0.35);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function stoneSurround(scene: ArtScene, c: StoneColours): void {
  const { ctx, style } = scene.env;
  const hand = stoneHand(scene, c);
  const ink = strokeWidth(scene.env, style.surround.stroke);
  ctx.save();
  clipLanes(scene);
  fillPockets(scene, c.rock);
  ctx.lineJoin = 'round';
  for (const poly of slabs(scene)) {
    ctx.beginPath();
    polyPath(poly)(ctx);
    ctx.fillStyle = c.rock;
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.38;
    hand.grain(polyPath(poly), 'rock');
    ctx.restore();
    // Split faces, rather than the rectangular joints of a dressed course.
    ctx.beginPath();
    polyPath(poly)(ctx);
    ctx.strokeStyle = withAlpha(c.line, 0.52);
    ctx.lineWidth = ink;
    ctx.stroke();
    ctx.save();
    ctx.translate(TO_LIGHT.x * 0.008, TO_LIGHT.y * 0.008);
    ctx.beginPath();
    runsPath(shadeEdges(poly, false))(ctx);
    ctx.strokeStyle = withAlpha(c.light, c.dark ? 0.2 : 0.5);
    ctx.lineWidth = 0.012;
    ctx.stroke();
    ctx.restore();
    strokeFracture(scene, poly, withAlpha(c.line, 0.22), 0.007);
  }
  ctx.restore();
}

export function engravedSurround(scene: ArtScene, pens: Pens): void {
  const { ctx, style } = scene.env;
  const ink = strokeWidth(scene.env, style.surround.stroke);
  ctx.save();
  clipLanes(scene);
  fillPockets(scene, mixColours(pens.floor, pens.ink, 0.12));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const poly of slabs(scene)) {
    ctx.beginPath();
    polyPath(poly)(ctx);
    ctx.fillStyle = pens.floor;
    ctx.fill();
    ctx.strokeStyle = pens.ink;
    ctx.lineWidth = ink;
    ctx.stroke();
    ctx.beginPath();
    runsPath(shadeEdges(poly, true))(ctx);
    ctx.lineWidth = ink * 1.8;
    ctx.stroke();
    strokeFracture(scene, poly, withAlpha(pens.ink, 0.5), 0.009);
  }
  ctx.restore();
}

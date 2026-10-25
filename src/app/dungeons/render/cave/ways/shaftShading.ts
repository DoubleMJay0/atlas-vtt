import type { Hand } from '../../art/hand';
import { SHADOW_DIR, TO_LIGHT, shadeEdges } from '../../art/light';
import { polyPath, polysPath, runsPath, type PathFn } from '../../art/paths';
import { pointsBounds, type Vec } from '../../geometry';
import { withAlpha } from '../../palette';
import { stoneOf } from './wayColours';
import { shiftedBack, type ShaftMouth } from './shaftMouth';
import type { WayFrame } from './narrows';

/**
 * How a shaft's depth is laid, in each painter's own way. Stone fills each ledge darker than the
 * one above it, then the rim's cast shadow on the side towards the light and a lit face on the side
 * away from it, all as plain fills (no sampled field: the shafts stay within the props' drawing
 * time, and an SVG keeps them). Engraved hatches the lower ledges at one tone each.
 */

/** How much darker each ledge is than the one round it (black's alpha over it, in Stone). */
const STONE_DEPTH = [0.16, 0.3, 0.4];
/** Each ring's hatching in Engraved: the upper ledges paper, the lowest hatched, the bottom solid. */
const ENGRAVED_DEPTH = [0, 0, 0.5, 1];
/** How far the rim's cast shadow and the lit face below its far lip reach into the shaft, in cells. */
const RIM_SHADOW = 0.15;
const RIM_LIT = 0.07;

function fillWith(hand: Hand, path: PathFn, style: string | CanvasGradient): void {
  const { ctx } = hand.scene.env;
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = style;
  ctx.fill();
  ctx.restore();
}

/** Ring `k` and the part of it its lip shades (`dir` SHADOW_DIR) or lights (`dir` TO_LIGHT). */
function crescent(ring: Vec[], dir: Vec, reach: number): PathFn {
  return polysPath([ring, shiftedBack(ring, dir, reach)]);
}

/**
 * Lays the depth of rings `from` up to but not including `to`, each ledge darker than the last.
 * Engraved hatches each ledge at one tone.
 */
export function layDepth(hand: Hand, mouth: ShaftMouth, from: number, to: number): void {
  const { rings } = mouth;
  const c = stoneOf(hand);
  const { ctx } = hand.scene.env;
  if (!c) {
    // Stepped as a drafter shades; constant tones keep the hatching cheap.
    for (let k = Math.max(1, from); k < to; k++) {
      const ring = rings[k]!;
      if (ENGRAVED_DEPTH[k]) hand.tone(() => ENGRAVED_DEPTH[k]!, pointsBounds(ring), polyPath(ring), 'shade');
    }
    if (from === 0) {
      const rim = rings[0]!;
      const lit = rim.filter(p => (p.x - mouth.centre.x) * TO_LIGHT.x + (p.y - mouth.centre.y) * TO_LIGHT.y > -0.05);
      ctx.save();
      ctx.beginPath();
      polyPath(rim)(ctx);
      ctx.clip();
      hand.tone(() => 0.62, pointsBounds(lit), crescent(rim, SHADOW_DIR, RIM_SHADOW), 'shade');
      ctx.restore();
    }
    return;
  }
  // The last ring is the bottom, which `layDark` lays.
  for (let k = from; k < Math.min(to, rings.length - 1); k++) {
    const ring = rings[k]!;
    // Each ledge once, as the band between its lip and the next, as dark as all above it together.
    // A dark look's rock is near black already: its upper ledges darken less, or the lit face would not show.
    let alpha = 1;
    for (let j = 0; j <= k; j++) alpha *= 1 - STONE_DEPTH[j]! * (c.dark ? 0.6 : 1);
    fillWith(hand, polysPath([ring, rings[k + 1]!.slice().reverse()]), withAlpha('#000000', 1 - alpha));
    if (k > 0) continue;
    ctx.save();
    ctx.beginPath();
    polyPath(ring)(ctx);
    ctx.clip();
    fillWith(hand, crescent(ring, SHADOW_DIR, RIM_SHADOW), withAlpha('#000000', 0.34));
    fillWith(hand, crescent(ring, TO_LIGHT, RIM_LIT), withAlpha(c.light, c.dark ? 0.3 : 0.22));
    ctx.restore();
  }
}

/** The rim's floor of rock: textured in Stone; Engraved leaves it paper for its hatching to be cut in. */
export function rimSurface(hand: Hand, rim: Vec[]): void {
  if (stoneOf(hand)) hand.surface(polyPath(rim), 'rock');
  else hand.fill(polyPath(rim), 'rock');
}

/** A ledge's lip inside the shaft: Stone's lit and shaded lips, Engraved's fine line with its shade cut where it faces the light. */
export function ledge(hand: Hand, ring: Vec[]): void {
  const c = stoneOf(hand);
  if (c) {
    // Only the lip that faces away from the light is drawn, catching it: the darker ledge below shows the rest.
    const { ctx } = hand.scene.env;
    ctx.save();
    ctx.beginPath();
    runsPath(shadeEdges(ring, true))(ctx);
    ctx.strokeStyle = withAlpha(c.light, c.dark ? 0.28 : 0.6);
    ctx.lineWidth = 0.016;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
    return;
  }
  hand.line([ring], 'fine', true);
  hand.line(shadeEdges(ring, false), 'outline');
}

/** The bottom of the shaft: as dark as the map goes, a little less towards its lit side in Stone pictures. */
export function layDark(hand: Hand, mouth: ShaftMouth): void {
  const core = mouth.rings[mouth.rings.length - 1]!;
  const c = stoneOf(hand);
  if (!c) return;
  const { ctx } = hand.scene.env;
  if (!hand.scene.raster) {
    fillWith(hand, polyPath(core), withAlpha('#000000', 0.86));
    return;
  }
  const box = pointsBounds(core);
  const r = Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2;
  const mid = { x: (box.minX + box.maxX) / 2 - TO_LIGHT.x * r * 0.25, y: (box.minY + box.maxY) / 2 - TO_LIGHT.y * r * 0.25 };
  const glow = ctx.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, r * 1.1);
  glow.addColorStop(0, 'rgba(0,0,0,0.96)');
  glow.addColorStop(1, 'rgba(0,0,0,0.8)');
  fillWith(hand, polyPath(core), glow);
}

/** Fills `path` with a gradient round `at` stretched to an ellipse of `rx` by `ry`: offsets are in units of it. */
function ellipticFill(hand: Hand, path: PathFn, at: Vec, rx: number, ry: number, stops: readonly [number, string][]): void {
  const { ctx } = hand.scene.env;
  const outer = stops[stops.length - 1]![0];
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.clip();
  ctx.translate(at.x, at.y);
  ctx.scale(rx, ry);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outer);
  for (const [offset, colour] of stops) gradient.addColorStop(offset / outer, colour);
  ctx.fillStyle = gradient;
  ctx.fillRect(-outer, -outer, outer * 2, outer * 2);
  ctx.restore();
}

/**
 * Daylight, or the glow of the floor above, falling down an aven onto the floor: a pool moved by
 * the light's slant, inside the ceiling's shadow round the opening, which fades out before the
 * stairwell's edge.
 */
export function layShaftLight(hand: Hand, frame: WayFrame, mouth: ShaftMouth): void {
  const { bounds, down } = frame;
  const fall = 0.12;
  const pool = mouth.rings[0]!.map(p => ({ x: p.x + SHADOW_DIR.x * fall, y: p.y + SHADOW_DIR.y * fall }));
  const at = { x: mouth.centre.x + SHADOW_DIR.x * fall, y: mouth.centre.y + SHADOW_DIR.y * fall };
  const rx = down.x ? mouth.half.v : mouth.half.u;
  const ry = down.x ? mouth.half.u : mouth.half.v;
  // Where the shadow has faded: short of the nearest edge of the stairwell's cells.
  const edge = Math.min((at.x - bounds.minX) / rx, (bounds.maxX - at.x) / rx, (at.y - bounds.minY) / ry, (bounds.maxY - at.y) / ry);
  const c = stoneOf(hand);
  // Engraved has no light to lay: a hatched shadow round the pool read as a hole's rim, so its dashes say it alone.
  if (!c) return;
  if (!hand.scene.raster) {
    fillWith(hand, polyPath(pool), withAlpha(c.light, c.dark ? 0.1 : 0.3));
    return;
  }
  // One gradient: the pool's light, clear at its edge, then the ceiling's shadow round it, gone before the stairwell's edge.
  const fade = Math.max(1.12, Math.min(1.5, edge));
  const ring = pool.map(p => ({ x: at.x + (p.x - at.x) * fade * 1.1, y: at.y + (p.y - at.y) * fade * 1.1 }));
  ellipticFill(hand, polyPath(ring), at, rx, ry, [
    [0, withAlpha(c.light, c.dark ? 0.24 : 0.55)], [0.75, withAlpha(c.light, c.dark ? 0.12 : 0.3)], [1, withAlpha(c.light, 0)],
    [1.04, withAlpha('#000000', 0.2)], [fade, withAlpha('#000000', 0)],
  ]);
}

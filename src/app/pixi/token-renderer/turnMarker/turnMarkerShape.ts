/**
 * The marker of the token whose turn it is, as pure geometry, in token-UI units
 * (`restingTokenUIScale`: 1 is one pixel beside a medium token on a 70 px grid): a pool of the
 * accent's light on the ground around the token, and four tapered arcs on its diagonals, clear of
 * the handles, nameplate and bars. The values are the look the online player page ports
 * (docs/plans/2026-10-20-initiative-turn-look.md).
 */
import { MOTION_SLOW_MS } from '../../../utils/motion';

/** The marker's look. Distances of the glow are UI units, those of the arcs screen pixels. */
export const TURN_LOOK = {
  /** How far the glow reaches beyond a medium token's edge; a larger token's reaches further (`glowSpread`). */
  glowReach: 26,
  /** How far inside the token's edge the glow begins, rising to its peak at the edge: the ring's soft outer edge. */
  glowInset: 0.75,
  /** The bright rim right at the token's edge: its opacity, and the distance over which it falls to 1/e. */
  rimAlpha: 0.3,
  rimWidth: 3,
  /** The wide pool beneath it. */
  poolAlpha: 0.38,
  poolWidth: 12,
  /**
   * How strongly the glow tints the map under it, which carries a light map, and how much light it
   * adds, a little only: enough to lift a dark map, where more washed parchment out to a white bloom.
   */
  glowTint: 1,
  glowLight: 0.15,
  /** The arcs: how many, how much of the circle each spans, their middle's distance from the token's edge and their width there. */
  arcs: 4,
  arcSpan: (72 * Math.PI) / 180,
  arcGap: 5,
  arcWidth: 2.25,
  /** The fewest screen pixels an arc is wide, so a map zoomed far out keeps it a line. */
  arcMinWidth: 1.5,
  /** The dark line around each arc, which keeps it readable on the glow and on a light map: UI units, at most `keylineMax` screen pixels. */
  keyline: 1,
  keylineMax: 1.5,
  keylineAlpha: 0.22,
  /** As the turn comes the marker lands from this much larger, its arcs turning this far into place. */
  appearFrom: 1.1,
  appearTurn: -Math.PI / 9,
} as const;

/** How long the marker takes to land (`$transition-slow`). */
export const MARKER_GROW_MS = MOTION_SLOW_MS;

/** A point in screen pixels about the token's middle. */
export interface ArcPoint {
  readonly x: number;
  readonly y: number;
}

/** `edge0` to `edge1` eased with zero slope at both ends. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** A medium token's edge, in UI units from its middle. */
const MEDIUM_EDGE = 35;

/** How much wider a token's glow spreads than a medium token's, for a token whose edge lies `edge` UI units from its middle. */
export function glowSpread(edge: number): number {
  return Math.sqrt(Math.max(1, edge / MEDIUM_EDGE));
}

/**
 * The glow's opacity `distance` UI units outside the token's edge (negative inside it): it rises
 * over the inset to the rim's peak at the edge, falls off as a bright rim over a wide pool, and
 * reaches exactly 0 with zero slope at its reach, so the pool has no edge of its own. `spread`
 * widens the rim, the pool and the reach for a larger token.
 */
export function glowAlpha(distance: number, spread = 1): number {
  const { glowInset, rimAlpha, rimWidth, poolAlpha, poolWidth } = TURN_LOOK;
  const reach = TURN_LOOK.glowReach * spread;
  if (distance <= -glowInset || distance >= reach) return 0;
  if (distance < 0) return (rimAlpha + poolAlpha) * smoothstep(-glowInset, 0, distance);
  const fade = 1 - (distance / reach) ** 2;
  const rim = rimAlpha * Math.exp(-((distance / (rimWidth * spread)) ** 2));
  const pool = poolAlpha * Math.exp(-((distance / (poolWidth * spread)) ** 2));
  return (rim + pool) * fade * fade;
}

/** Where the glow lies about a token whose edge is `outerRadius` world units from its middle, at `unit` world units per UI unit. */
export interface GlowExtent {
  /** The outer radius of the glow's sprite, in world units. */
  readonly radius: number;
  /** The token's edge as a share of `radius`. */
  readonly edgeShare: number;
  /** World units per UI unit, as a share of `radius`. */
  readonly unitShare: number;
  /** How much wider than a medium token's the glow spreads. */
  readonly spread: number;
}

export function glowExtent(outerRadius: number, unit: number): GlowExtent {
  const spread = glowSpread(outerRadius / unit);
  const radius = outerRadius + TURN_LOOK.glowReach * spread * unit;
  return { radius, edgeShare: outerRadius / radius, unitShare: unit / radius, spread };
}

/**
 * The glow's opacity at `share` of its sprite's radius (0 at the middle, 1 at its edge): what the
 * glow texture holds, sampled once per texel.
 */
export function glowAlphaAt(share: number, extent: Pick<GlowExtent, 'edgeShare' | 'unitShare' | 'spread'>): number {
  return glowAlpha((share - extent.edgeShare) / extent.unitShare, extent.spread);
}

/**
 * Texels across the glow's texture for a sprite `radius` world units wide: about four per world
 * unit, so it stays smooth up to a zoom of four, between 256 and 1024 (mipmaps take it down).
 */
export function glowTextureSize(radius: number): number {
  const wanted = 8 * radius;
  return Math.min(1024, Math.max(256, 2 ** Math.ceil(Math.log2(Math.max(1, wanted)))));
}

/** Where the arcs lie on screen around a token whose edge is `outerRadius` world units from its middle, in screen pixels. */
export interface ArcLayout {
  /** The arcs' middle line from the token's middle. */
  readonly radius: number;
  readonly width: number;
  readonly keyline: number;
}

/** The arcs stand off and thicken with the glow around a larger token (`glowSpread`). */
export function arcLayout(outerRadius: number, unit: number, zoom: number): ArcLayout {
  const { arcGap, arcWidth, arcMinWidth, keyline, keylineMax } = TURN_LOOK;
  const spread = glowSpread(outerRadius / unit);
  return {
    radius: (outerRadius + arcGap * spread * unit) * zoom,
    width: Math.max(arcMinWidth, arcWidth * spread * unit * zoom),
    keyline: Math.min(keylineMax, Math.max(1, keyline * unit * zoom)),
  };
}

/** Pieces enough that an arc of `radius` screen pixels strays no more than a twentieth of a pixel from its chords. */
function arcSteps(radius: number, angle: number): number {
  if (!(radius > 0.05)) return 2;
  return Math.max(2, Math.ceil(angle / (2 * Math.acos(1 - 0.05 / radius))));
}

/**
 * How wide an arc is at `along` (-1 at one end, 1 at the other) as a share of its middle: a brush
 * stroke thinning all the way to fine points. A flatter profile kept its width almost to the end and
 * stopped in a blunt cut across the arc.
 */
export function arcTaper(along: number): number {
  return Math.max(0, 1 - along * along) ** 1.25;
}

/**
 * The arcs as closed polygons about the token's middle, in screen pixels: centred on the diagonals,
 * `radius` from the middle, `width` across at their middle and tapering to points.
 */
export function arcPolygons(radius: number, width: number): ArcPoint[][] {
  const { arcs, arcSpan } = TURN_LOOK;
  const steps = arcSteps(radius + width / 2, arcSpan);
  const polygons: ArcPoint[][] = [];
  for (let arc = 0; arc < arcs; arc += 1) {
    const middle = Math.PI / 4 + (arc * 2 * Math.PI) / arcs;
    const outer: ArcPoint[] = [];
    const inner: ArcPoint[] = [];
    for (let step = 0; step <= steps; step += 1) {
      const along = (2 * step) / steps - 1;
      const angle = middle + (along * arcSpan) / 2;
      const half = (width / 2) * arcTaper(along);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      outer.push({ x: cos * (radius + half), y: sin * (radius + half) });
      inner.push({ x: cos * (radius - half), y: sin * (radius - half) });
    }
    polygons.push([...outer, ...inner.reverse()]);
  }
  return polygons;
}

/** How the marker shows `growth` of the way through landing (0 as the turn comes, 1 once landed). */
export interface MarkerAppearance {
  readonly alpha: number;
  readonly scale: number;
  /** How far the arcs are still turned from their place, in radians. */
  readonly turn: number;
}

export function markerAppearance(growth: number): MarkerAppearance {
  const g = Math.min(1, Math.max(0, growth));
  return { alpha: g, scale: TURN_LOOK.appearFrom + (1 - TURN_LOOK.appearFrom) * g, turn: TURN_LOOK.appearTurn * (1 - g) };
}

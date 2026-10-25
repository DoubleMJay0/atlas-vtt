import type { Canvas2D, Vec } from '../geometry';
import { mixColours } from '../palette';
import type { StoneColours } from './colours';

/**
 * Rock as a painter blocks it in: flat facets, each one tone of a few steps set by how it faces
 * the one light at the top left, never a gradient or a noise. Facets are gathered per tone and
 * filled once each, so a band of thousands of chips costs a handful of fills.
 */

/** A point of a facet with its height above the floor, in cells. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** The light, as the textures have it: from the top left, a little above the map. */
const LIGHT = (() => {
  const l = [-0.5, -0.5, 0.71];
  const n = Math.hypot(...l);
  return { x: l[0]! / n, y: l[1]! / n, z: l[2]! / n };
})();

/** Tone steps below and above the rock's own colour. */
const SHADE_STEPS = 3;
const LIT_STEPS = 2;
/**
 * How much one step of shade or light moves the colour. A dark look's rock lies near its paper, so
 * its shade steps stay small (deeper, a facet would take the paper's colour and read as a hole)
 * and the light carries the modelling.
 */
const SHADE_STEP = { light: 0.13, dark: 0.04 };
const LIT_STEP = { light: 0.13, dark: 0.12 };

/** The tones of a rock, darkest first; index `SHADE_STEPS` is the rock's own colour. */
export function rockTones(c: StoneColours, rock = c.rock): string[] {
  const deep = c.dark ? '#000000' : c.line;
  const lit = c.mono ? c.floor : c.light;
  const shade = c.dark ? SHADE_STEP.dark : SHADE_STEP.light;
  const light = c.dark ? LIT_STEP.dark : LIT_STEP.light;
  const tones: string[] = [];
  for (let k = SHADE_STEPS; k > 0; k--) tones.push(mixColours(rock, deep, k * shade));
  tones.push(rock);
  for (let k = 1; k <= LIT_STEPS; k++) tones.push(mixColours(rock, lit, k * light));
  return tones;
}

/** How much a facet is lit beyond a flat floor's light, from its corners (Newell's normal); 0 is level. */
export function facetLight(corners: readonly Vec3[]): number {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
  }
  // Facets face up whichever way their corners turn.
  if (nz < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const length = Math.hypot(nx, ny, nz) || 1;
  return (nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z) / length - LIGHT.z;
}

/** Facets gathered by tone and filled once per tone. */
export class FacetBatch {
  private readonly polys: Vec[][][];

  constructor(private readonly tones: readonly string[]) {
    this.polys = tones.map(() => []);
  }

  /** Adds a facet lit `light` beyond level (`facetLight`), `steps` tones to a unit of light. */
  add(poly: readonly Vec[], light: number, steps = 5): void {
    const k = Math.round(light * steps);
    const index = Math.max(0, Math.min(this.tones.length - 1, SHADE_STEPS + k));
    this.polys[index]!.push(poly as Vec[]);
  }

  fill(ctx: Canvas2D): void {
    for (let t = 0; t < this.tones.length; t++) {
      const polys = this.polys[t]!;
      if (!polys.length) continue;
      ctx.beginPath();
      for (const poly of polys) {
        ctx.moveTo(poly[0]!.x, poly[0]!.y);
        for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
        ctx.closePath();
      }
      ctx.fillStyle = this.tones[t]!;
      ctx.fill();
    }
  }
}

/**
 * A boulder or slab seen from above as its planes, as an inked boulder is split: a flat top round
 * `apex`, `top` of the way in from the outline and tipped a little by `tip` (its slopes along x and
 * y), and a bevelled face down from each edge of the top to the outline, `height` below it.
 */
export function boulderFacets(poly: readonly Vec[], apex: Vec, height: number, top: number, tip: Vec): { face: Vec[]; light: number }[] {
  const lift = (p: Vec): number => height + (p.x - apex.x) * tip.x + (p.y - apex.y) * tip.y;
  const ridge = poly.map(p => ({ x: apex.x + (p.x - apex.x) * top, y: apex.y + (p.y - apex.y) * top }));
  const out: { face: Vec[]; light: number }[] = [{ face: ridge, light: facetLight(ridge.map(p => ({ ...p, z: lift(p) }))) }];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const face = [poly[i]!, poly[j]!, ridge[j]!, ridge[i]!];
    out.push({ face, light: facetLight([{ ...poly[i]!, z: 0 }, { ...poly[j]!, z: 0 }, { ...ridge[j]!, z: lift(ridge[j]!) }, { ...ridge[i]!, z: lift(ridge[i]!) }]) });
  }
  return out;
}

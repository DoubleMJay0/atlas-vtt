import type { Hand } from '../../art/hand';
import type { PathFn } from '../../art/paths';
import { lavaDuotone } from '../../art/lavaPalette';
import type { Vec } from '../../geometry';
import { circlePath, strokeFine, type GlyphPen } from '../../glyphPen';
import { mixColours, withAlpha } from '../../palette';

/**
 * A fire that burns, seen from above: a glowing bed, the charred fuel lying in it with embers along
 * its cracks, and a few flame tongues leaning the way the draught pulls them. Stone paints it in
 * fire's colours (two pigments in Monochrome, from dark to light as lava's heat); Engraved cuts the
 * tongues in ink on paper and lays the fuel in solid ink. Each part is one pass over all its pieces,
 * as a fire is many small things and every canvas call counts.
 */

export interface FireColours {
  /** Wood burnt black. */
  char: string;
  /** The red of embers in the cracks and of sparks. */
  ember: string;
  flame: string;
  /** The pale heart of a flame. */
  core: string;
}

const colourCache = new WeakMap<Hand, FireColours>();

/** Stone & shadow fills with colour; Engraved leaves the paper and cuts its parts in lines. */
function painted(pen: GlyphPen): boolean {
  return pen.hand.scene.env.style.direction === 'stone';
}

/** A fire's colours in the look of `pen`: fire's own, Monochrome's two pigments, or Engraved's ink and paper. */
export function fireColours(pen: GlyphPen): FireColours {
  let colours = colourCache.get(pen.hand);
  if (!colours) {
    colours = coloursOf(pen);
    colourCache.set(pen.hand, colours);
  }
  return colours;
}

function coloursOf(pen: GlyphPen): FireColours {
  const { palette, view } = pen.hand.scene.env;
  if (!painted(pen)) return { char: palette.ink, ember: palette.ink, flame: palette.floor, core: palette.floor };
  if (view.monochrome) {
    const { deep, surface, glint } = lavaDuotone(palette.ink, palette.floor);
    return { char: deep, ember: surface, flame: mixColours(surface, glint, 0.55), core: glint };
  }
  return { char: '#2b1a12', ember: '#c4421c', flame: '#f2862e', core: '#ffd98a' };
}

/** A flame tongue round `c`, `r` across at its base, its tip `length` away along `lean`. */
export function tongue(path: CanvasPath, c: Vec, r: number, lean: Vec, length: number): void {
  const a = Math.atan2(lean.y, lean.x);
  const n = { x: -lean.y * r, y: lean.x * r };
  const tip = { x: c.x + lean.x * length, y: c.y + lean.y * length };
  const bulge = length * 0.35;
  path.moveTo(tip.x, tip.y);
  path.quadraticCurveTo(c.x + n.x + lean.x * bulge, c.y + n.y + lean.y * bulge, c.x + n.x, c.y + n.y);
  path.arc(c.x, c.y, r, a + Math.PI / 2, a + (Math.PI * 3) / 2);
  path.quadraticCurveTo(c.x - n.x + lean.x * bulge, c.y - n.y + lean.y * bulge, tip.x, tip.y);
  path.closePath();
}

/** A flame tongue: where it stands, half its base, its length and the way it leans. */
export interface Tongue {
  at: Vec;
  r: number;
  length: number;
  lean: Vec;
}

/**
 * The glow of a fire's bed: an ellipse of `rx` by `ry` round `c`, brightest in its middle and gone
 * at its rim, kept inside `bed` (the recess or ash it lies in). Stone's raster wash alone, as a
 * vector picture and Engraved's line work carry no wash.
 */
export function fireGlow(pen: GlyphPen, bed: PathFn, c: Vec, rx: number, ry: number): void {
  if (!painted(pen) || !pen.hand.scene.raster) return;
  const { ctx } = pen;
  const { core, flame, ember } = fireColours(pen);
  ctx.save();
  ctx.beginPath();
  bed(ctx);
  ctx.clip();
  ctx.translate(c.x, c.y);
  ctx.scale(1, ry / rx);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  glow.addColorStop(0, withAlpha(core, 0.9));
  glow.addColorStop(0.3, withAlpha(flame, 0.75));
  glow.addColorStop(0.7, withAlpha(ember, 0.4));
  glow.addColorStop(1, withAlpha(ember, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** The flames: every tongue filled at once, then their hearts; in Engraved paper outlined in ink, the hearts a fine line. */
export function flames(pen: GlyphPen, tongues: readonly Tongue[]): void {
  const { ctx } = pen;
  const { flame, core } = fireColours(pen);
  const ink = ctx.strokeStyle;
  ctx.beginPath();
  for (const t of tongues) tongue(ctx, t.at, t.r, t.lean, t.length);
  ctx.fillStyle = flame;
  ctx.fill();
  if (!painted(pen)) strokeFine(pen);
  ctx.beginPath();
  for (const t of tongues) tongue(ctx, { x: t.at.x + t.lean.x * t.r * 0.3, y: t.at.y + t.lean.y * t.r * 0.3 }, t.r * 0.5, t.lean, t.length * 0.55);
  if (painted(pen)) {
    ctx.fillStyle = core;
    ctx.fill();
  } else {
    strokeFine(pen);
  }
  ctx.strokeStyle = ink;
}

/** Charred fuel: its pieces filled in char, the embers in its cracks and the sparks round it in ember red. */
export function charredFuel(pen: GlyphPen, pieces: PathFn, cracks: readonly number[], sparks: readonly (readonly [number, number, number])[]): void {
  const { ctx } = pen;
  const { char, ember } = fireColours(pen);
  const ink = ctx.strokeStyle;
  ctx.beginPath();
  pieces(ctx);
  ctx.fillStyle = char;
  ctx.fill();
  ctx.strokeStyle = painted(pen) ? ember : pen.hand.scene.env.palette.floor;
  ctx.beginPath();
  for (let i = 0; i < cracks.length; i += 4) {
    ctx.moveTo(cracks[i]!, cracks[i + 1]!);
    ctx.lineTo(cracks[i + 2]!, cracks[i + 3]!);
  }
  // A split glows wider than a fine line, so the embers read through the char.
  const width = ctx.lineWidth;
  ctx.lineWidth = pen.fine * 2;
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.beginPath();
  for (const [x, y, r] of sparks) circlePath(ctx, r, x, y);
  ctx.fillStyle = ember;
  ctx.fill();
  ctx.strokeStyle = ink;
}

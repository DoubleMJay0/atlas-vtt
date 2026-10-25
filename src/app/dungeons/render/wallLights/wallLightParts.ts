import type { PathFn } from '../art/paths';
import type { Vec } from '../geometry';
import type { GlyphPen } from '../glyphPen';
import { mixColours } from '../palette';
import { fireColours, fireGlow, flames, tongue, type Tongue } from '../props/fire/burning';
import { colours, isPainted, onDarkFloor, stick, surface } from '../props/livedIn/parts';
import { OFF_WALL } from '../propsAsDrawn';

/**
 * What the wall lights share: the floor's glow before a flame, a torch's shaft and its pitch-soaked
 * head, the flame itself (the fires' own tongues, `burning.ts`), and a sconce's brass.
 */

/** The floor before a wall light, on the room's side of its wall: where its glow may fall. */
const BEFORE_WALL: PathFn = path => path.rect(-0.8, -0.9, 1.6, 0.9 + OFF_WALL);

/** The glow a flame throws on the floor and wall face round it, `r` cells across, as faint as `strength`: Stone's raster wash alone. */
export function floorGlow(pen: GlyphPen, at: Vec, r: number, strength: number, clip: PathFn = BEFORE_WALL): void {
  fireGlow(pen, clip, at, r, r, strength);
}

/** A torch's shaft from `base` to `head`, its wood's grain along it. */
export function torchShaft(pen: GlyphPen, base: Vec, head: Vec, width: number): void {
  const shaft = stick(base, head, width, width * 1.15, 0.002);
  surface(pen, path => {
    path.moveTo(shaft[0]!.x, shaft[0]!.y);
    for (const p of shaft.slice(1)) path.lineTo(p.x, p.y);
    path.closePath();
  }, 'wood', !isPainted(pen));
}

/** A torch's head: rags wound round its end and soaked in pitch, charred black where the flame stands on them, two windings showing. */
export function torchHead(pen: GlyphPen, at: Vec, r: number, along: Vec): void {
  const { ctx } = pen;
  const { char } = fireColours(pen);
  const n = { x: -along.y, y: along.x };
  surface(pen, path => {
    path.ellipse(at.x, at.y, r, r * 0.82, Math.atan2(along.y, along.x), 0, Math.PI * 2);
  }, 'cloth', false, true, isPainted(pen) ? char : colours(pen, 'floor').fill, isPainted(pen) ? mixColours(char, '#000000', 0.4) : undefined);
  const ink = ctx.strokeStyle;
  ctx.strokeStyle = isPainted(pen) ? fireColours(pen).ember : colours(pen, 'cloth').ink;
  ctx.beginPath();
  for (const k of [-0.45, 0.35]) {
    const c = { x: at.x + along.x * r * k, y: at.y + along.y * r * k };
    ctx.moveTo(c.x - n.x * r * 0.8, c.y - n.y * r * 0.8);
    ctx.lineTo(c.x + n.x * r * 0.8, c.y + n.y * r * 0.8);
  }
  ctx.lineWidth = pen.fine;
  ctx.stroke();
  ctx.strokeStyle = ink;
}

/**
 * A torch's flame seen from above: a ragged rosette of `count` tongues round `at`, `r` across each
 * at its base, longest (`length`) on the side the draught leans it (`lean`) and short on the other,
 * their hearts making its pale middle.
 */
export function torchFlame(pen: GlyphPen, at: Vec, r: number, length: number, lean: Vec, count = 6): void {
  const base = Math.atan2(lean.y, lean.x);
  const tongues: Tongue[] = Array.from({ length: count }, (_, k) => {
    const a = base + ((k + 0.5) / count - 0.5) * Math.PI * 1.7 + (k % 2 ? 0.12 : -0.08);
    const toward = 0.5 + 0.5 * Math.cos(a - base);
    const l = { x: Math.cos(a), y: Math.sin(a) };
    return { at: { x: at.x + l.x * r * 0.35, y: at.y + l.y * r * 0.35 }, r: r * (0.62 + 0.38 * toward), length: length * (0.38 + 0.62 * toward) * (k % 3 === 1 ? 0.82 : 1), lean: l };
  });
  flames(pen, tongues);
}

/** A candle's flame seen from above: a single small tongue and its bright heart. */
export function candleFlame(pen: GlyphPen, at: Vec, r: number, lean: Vec): void {
  const { ctx } = pen;
  const { flame, core } = fireColours(pen);
  const ink = ctx.strokeStyle;
  ctx.beginPath();
  tongue(ctx, at, r, lean, r * 3);
  ctx.fillStyle = flame;
  ctx.fill();
  if (!isPainted(pen)) {
    ctx.lineWidth = pen.fine;
    ctx.stroke();
  } else {
    ctx.beginPath();
    tongue(ctx, at, r * 0.5, lean, r * 1.6);
    ctx.fillStyle = core;
    ctx.fill();
  }
  ctx.strokeStyle = ink;
}

/** A sconce's brass: the iron's own paint warmed to yellow metal where the look has colour; iron where it has none or is dark. */
export function brass(pen: GlyphPen): { fill: string; ink: string } {
  const metal = colours(pen, 'metal');
  const { view } = pen.hand.scene.env;
  if (!isPainted(pen) || view.monochrome) return metal;
  return { fill: mixColours(metal.fill, onDarkFloor(pen) ? '#9a7630' : '#cca24c', 0.85), ink: mixColours(metal.ink, '#4a3410', 0.6) };
}

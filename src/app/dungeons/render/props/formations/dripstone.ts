import { glyphEdges, lightInGlyph } from '../../art/glyphLight';
import { polyPath } from '../../art/paths';
import type { Vec } from '../../geometry';
import type { GlyphPen } from '../../glyphPen';
import type { GlyphFit } from '../../propShapes';
import { calcite, calciteGrain, coneShade, facing, modelled, raisedEdges, fillOutline, fineRuns, outlineRuns, splitByLight, type Finish } from './finish';
import { COLUMN, MOUND_PAD, MOUNDS, SHEET_TOP, curtainFoot, curtainLine, flowLobes, flowSheet, ribbon, type Mound } from './shapes';

/**
 * Calcite that dripping water built: stalagmites as cones seen from straight above (rings of growth
 * climbing to a wet tip), a column's broad fluted foot, flowstone poured down a wall and a
 * curtain folded along it. Each is drawn once here; the painter's finish lights and shades it.
 */

/** A short arc of `r` round `c`, centred on the light's side: where a wet cone glints. */
function glint(pen: GlyphPen, c: Vec, r: number, spread: number): Vec[] {
  const light = lightInGlyph(pen);
  const a0 = Math.atan2(light.y, light.x);
  return Array.from({ length: 6 }, (_, k) => {
    const a = a0 + (k / 5 - 0.5) * spread;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });
}

/** One stalagmite: its foot, its flank shaded away from the light, its rings, its wet tip. */
function cone(pen: GlyphPen, m: Mound, finish: Finish): void {
  const foot = polyPath(m.foot);
  fillOutline(pen, m.foot, calcite(pen), 'none');
  calciteGrain(pen, foot, finish);
  modelled(pen, foot, m.tip, m.r, 0.8, finish);
  coneShade(pen, foot, m.tip, m.r, finish.painter === 'stone' ? 0.75 : 0.5, finish);
  fineRuns(pen, m.r < 0.09 ? m.rings.slice(0, 2) : m.rings, true, 0.7);
  finish.sheen(pen, [glint(pen, m.tip, m.r * 0.32, 1.4), glint(pen, m.tip, m.r * 0.62, 0.8)]);
  raisedEdges(pen, m.foot, m.r, finish);
  if (m.r >= 0.12) fineRuns(pen, [glint(pen, m.tip, m.r * 0.09, Math.PI * 2)], true);
}

/** A clump of stalagmites on the calcite they poured. */
export function stalagmites(pen: GlyphPen, _fit: GlyphFit, finish: Finish): void {
  fillOutline(pen, MOUND_PAD, pen.palette.fill);
  calciteGrain(pen, polyPath(MOUND_PAD), finish);
  for (const m of MOUNDS) cone(pen, m, finish);
}

/** A column: its rippled skirt, the cones at its foot, its fluted shaft standing round in the light. */
export function columnFormation(pen: GlyphPen, _fit: GlyphFit, finish: Finish): void {
  const { skirt, drips, shaft, core, foot } = COLUMN;
  fillOutline(pen, skirt, pen.palette.fill, 'none');
  calciteGrain(pen, polyPath(skirt), finish);
  coneShade(pen, polyPath(skirt), { x: 0, y: 0 }, 0.4, 0.3, finish);
  glyphEdges(pen, skirt, true);
  fineRuns(pen, drips, true, 0.7);
  for (const m of foot) cone(pen, m, finish);
  const body = polyPath(shaft);
  fillOutline(pen, shaft, calcite(pen), 'none');
  calciteGrain(pen, body, finish);
  modelled(pen, body, { x: 0, y: 0 }, 0.27, 1.1, finish);
  coneShade(pen, body, { x: 0, y: 0 }, 0.25, finish.painter === 'stone' ? 0.8 : 0.55, finish);
  // Flutes: grooves down the shaft between its swellings, cut deeper on the side away from the light.
  const flutes: Vec[][] = [];
  const deep: Vec[][] = [];
  for (let k = 0; k < 11; k++) {
    const a = (Math.PI * 1.5 - 0.3 + k * Math.PI * 2) / 11;
    const out = { x: Math.cos(a), y: Math.sin(a) };
    const run = [{ x: out.x * 0.14, y: out.y * 0.14 }, { x: out.x * 0.235, y: out.y * 0.235 }];
    (facing(pen, out) < -0.3 ? deep : flutes).push(run);
  }
  fineRuns(pen, flutes, false, 0.8);
  outlineRuns(pen, deep);
  fineRuns(pen, [core], true, 0.6);
  finish.sheen(pen, [glint(pen, { x: 0, y: 0 }, 0.19, 0.9), glint(pen, { x: 0, y: 0 }, 0.1, 1.1)]);
  glyphEdges(pen, shaft, true);
}

/** The faces a strip between two runs makes, each facing the way its outer run's segment does. */
function strip(outer: readonly Vec[], inner: readonly Vec[]): { poly: Vec[]; out: Vec }[] {
  return outer.slice(1).map((b, i) => {
    const a = outer[i]!;
    return { poly: [a, b, inner[i + 1]!, inner[i]!], out: { x: b.y - a.y, y: -(b.x - a.x) } };
  });
}

/** Flowstone: a sheet poured down the wall, its tongues rolling over at their lips, its flow lines following the slope. */
export function flowstone(pen: GlyphPen, fit: GlyphFit, finish: Finish): void {
  const sheet = flowSheet(fit);
  const { edge, tips } = flowLobes(fit);
  fillOutline(pen, sheet, calcite(pen), 'none');
  calciteGrain(pen, polyPath(sheet), finish);
  // Bands of stain follow the lip, as each flood laid its film.
  const towardWall = (f: number): Vec[] => edge.map(p => ({ x: p.x, y: p.y + (SHEET_TOP - p.y) * f }));
  for (const [from, to] of [[0.18, 0.34], [0.55, 0.72]] as const) finish.stain(pen, polyPath([...towardWall(from), ...towardWall(to).reverse()]));
  // The sheet faces the room; it catches the light or falls into shade as the room lies to it.
  splitByLight(pen, [{ poly: sheet, out: { x: 0, y: -1 } }], finish, 0.3);
  // Each tongue's lip rolls over: lit where it turns to the light, shaded where it turns away.
  const lip = edge.map(p => ({ x: p.x, y: Math.min(SHEET_TOP, p.y + 0.03) }));
  splitByLight(pen, strip(edge, lip), finish, 0.2);
  const lines: Vec[][] = [];
  for (const [i, tip] of tips.entries()) {
    for (const side of [-1, 1]) {
      const spread = side * (0.035 + (i % 2) * 0.012);
      lines.push([{ x: tip.x + spread * 0.4, y: SHEET_TOP - 0.008 }, { x: tip.x + spread, y: (SHEET_TOP + tip.y) / 2 }, { x: tip.x + spread * 0.55, y: tip.y + 0.035 }]);
    }
  }
  fineRuns(pen, [...lines, lip], false, 0.6);
  finish.sheen(pen, tips.map(t => [{ x: t.x - 0.03, y: t.y + 0.012 }, { x: t.x + 0.015, y: t.y + 0.016 }]));
  pen.hand.line([edge], 'outline');
}

/** A curtain: calcite folded to and fro along the wall, every other fold catching the light, over the flowstone at its foot. */
export function curtain(pen: GlyphPen, fit: GlyphFit, finish: Finish): void {
  const foot = curtainFoot(fit);
  fillOutline(pen, foot, calcite(pen), 'none');
  calciteGrain(pen, polyPath(foot), finish);
  finish.stain(pen, polyPath(foot));
  outlineRuns(pen, [foot.slice(0, -2)]);
  const line = curtainLine(fit);
  const rib = ribbon(line, 0.072);
  fillOutline(pen, rib, calcite(pen), 'none');
  // Each half fold faces its own way: those towards the light are lit, the others shaded.
  const n = line.length;
  const outer = rib.slice(0, n);
  const inner = rib.slice(n).reverse();
  splitByLight(pen, strip(line, outer), finish, 0.12);
  splitByLight(pen, strip(inner, line), finish, 0.12);
  // Every other fold carries a band of stain across it, the curtain's growth lines.
  const n2 = Math.floor((n - 1) / 8);
  for (let f = 0; f < n2; f += 2) finish.stain(pen, polyPath([...outer.slice(f * 8 + 2, f * 8 + 7), ...inner.slice(f * 8 + 2, f * 8 + 7).reverse()]));
  // Bands of growth along it, and a crease at each fold.
  const creases: Vec[][] = [];
  for (let i = 4; i < n - 1; i += 4) creases.push([outer[i]!, inner[i]!]);
  fineRuns(pen, [line, ...creases], false, 0.65);
  pen.ctx.beginPath();
  polyPath(rib)(pen.ctx);
  pen.ctx.stroke();
  if (finish.painter === 'stone') glyphEdges(pen, rib, true);
}

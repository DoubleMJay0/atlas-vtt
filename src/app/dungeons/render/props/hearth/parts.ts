import { glyphEdges, glyphTone } from '../../art/glyphLight';
import type { Hand, Material } from '../../art/hand';
import { polyPath, type PathFn } from '../../art/paths';
import { fineLines, inkDot, type GlyphPen } from '../../glyphPen';
import { mixColours } from '../../palette';
import { isDarkColour } from '../../stone/colours';
import { partPath, partPoly, type Part } from './shapes';

type Paint = ReturnType<GlyphPen['paint']>;
// A hand owns one immutable look palette. Reuse its material mixes across parts
// and repeated glyphs; the weak key releases them with the rendered scene.
const paints = new WeakMap<Hand, Partial<Record<Material, Paint>>>();

/** Masonry a look draws towards its light ink on a dark floor, so a fireplace stands pale there as calcite does. */
const PALE_ON_DARK: ReadonlySet<Material> = new Set(['dressed', 'stone']);

function materialPaint(pen: GlyphPen, material: Material): Paint {
  let colours = paints.get(pen.hand);
  if (!colours) {
    colours = {};
    paints.set(pen.hand, colours);
  }
  return colours[material] ??= paleOnDark(pen, material, pen.paint(material));
}

function paleOnDark(pen: GlyphPen, material: Material, paint: Paint): Paint {
  const { env } = pen.hand.scene;
  const dark = env.style.direction === 'stone' && !env.view.monochrome && isDarkColour(pen.paint('floor').fill);
  return dark && PALE_ON_DARK.has(material) ? { fill: mixColours(paint.fill, env.palette.ink, 0.24), ink: paint.ink } : paint;
}

/** A part always uses its own material's ink, including in the dark looks. */
export function surface(pen: GlyphPen, path: PathFn, material: Material, texture = false, outlined = true): void {
  const paint = materialPaint(pen, material);
  const ink = pen.ctx.strokeStyle;
  pen.ctx.beginPath();
  path(pen.ctx);
  pen.ctx.fillStyle = paint.fill;
  pen.ctx.strokeStyle = paint.ink;
  pen.ctx.fill();
  if (outlined) pen.ctx.stroke();
  if (texture) pen.hand.grain(path, material);
  pen.ctx.strokeStyle = ink;
}

export function part(pen: GlyphPen, b: Part, material: Material, raised = true): void {
  surface(pen, partPath(b), material, false, !raised);
  if (raised) glyphEdges(pen, partPoly(b), true);
}

/** Bounded depth: darkening ash in Stone, cross-cut lines in Engraved, and a vector lip in SVG. */
export function recess(pen: GlyphPen, b: Part, painted: boolean): void {
  surface(pen, partPath(b), 'stone');
  if (painted) {
    // The depth field is linear: paint its black alpha ramp directly, avoiding a
    // raster layer per basin. Like Stone's tone, this wash is raster-only.
    if (pen.hand.scene.raster) {
      const { ctx } = pen;
      ctx.save();
      const wash = ctx.createLinearGradient(b.x, b.y - b.h / 2, b.x, b.y + b.h / 2);
      wash.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
      wash.addColorStop(1, 'rgba(0, 0, 0, 0.68)');
      ctx.beginPath();
      partPath(b)(ctx);
      ctx.fillStyle = wash;
      ctx.fill();
      ctx.restore();
    }
  } else {
    glyphTone(pen, (_x, y) => 0.25 + 0.43 * (y - b.y + b.h / 2) / b.h,
      { minX: b.x - b.w / 2, minY: b.y - b.h / 2, maxX: b.x + b.w / 2, maxY: b.y + b.h / 2 }, partPath(b), 'depth');
  }
  glyphEdges(pen, partPoly(b), false);
}

/** Two split logs lie low in the firebox; irregular pale ash remains visible between them. */
export function coldFuel(pen: GlyphPen, b: Part): void {
  const at = (x: number, y: number): { x: number; y: number } => ({ x: b.x + x * b.w, y: b.y + y * b.h });
  surface(pen, polyPath([at(-0.39, -0.31), at(-0.12, -0.4), at(0.05, -0.34), at(0.37, -0.36), at(0.4, 0.16), at(0.15, 0.25), at(-0.32, 0.15)]), 'dressed');
  const logs = [-0.16, 0.14].map(y => polyPath([
    at(-0.32, y - 0.08), at(0.27, y - 0.02), at(0.32, y + 0.1), at(-0.27, y + 0.08),
  ]));
  // Stone's final silhouette grain covers the fuel too; Engraved needs the wood cuts here.
  surface(pen, path => { for (const log of logs) log(path); }, 'wood', pen.hand.scene.env.style.direction === 'engraved');
  fineLines(pen, [-0.16, 0.14].flatMap(y => {
    const a = at(-0.22, y - 0.01);
    const z = at(0.21, y + 0.04);
    return [a.x, a.y, z.x, z.y];
  }));
  for (const [x, y] of [[-0.35, 0.3], [0.29, -0.3], [0.1, 0.31]] as const) {
    const p = at(x, y);
    inkDot(pen, p.x, p.y, 0.012);
  }
}

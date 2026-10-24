import { glyphEdges, glyphSolid } from '../../art/glyphLight';
import { centroid, polyPath } from '../../art/paths';
import type { Vec } from '../../geometry';
import type { GlyphPen } from '../../glyphPen';
import { mixColours } from '../../palette';
import type { GlyphFit } from '../../propShapes';
import { fillOutline, fineRuns, outlineRuns, splitByLight, type Finish } from './finish';
import { BOULDERS, CHIPS, CRYSTALS, MATRIX, crack, type Block, type Crystal } from './shapes';

/**
 * What a cave's rock does by itself: crystals grown out of it, and blocks fallen from its roof.
 * Faces are told apart by where they turn to the one light, so a crystal's facets and a block's
 * fracture faces read in every look and at every turn.
 */

/** A crystal: its body leaning out of the rock, its pointed end of six facets, its clear, water-tinted heart. */
function crystalPiece(pen: GlyphPen, c: Crystal, finish: Finish): void {
  const clear = mixColours(pen.palette.fill, pen.palette.water, 0.45);
  fillOutline(pen, c.body, clear, 'none');
  splitByLight(pen, c.sides, finish, 0.2);
  fineRuns(pen, [c.ridge], false, 0.7);
  // The prism's long edges: from the termination's corners back into the rock.
  const facets = c.hex.map((p, k) => {
    const q = c.hex[(k + 1) % 6]!;
    return { poly: [c.apex, p, q], out: { x: (p.x + q.x) / 2 - c.apex.x, y: (p.y + q.y) / 2 - c.apex.y } };
  });
  fillOutline(pen, c.hex, pen.palette.fill, 'none');
  splitByLight(pen, facets, finish, 0.1);
  const core = c.hex.map(p => ({ x: c.apex.x + (p.x - c.apex.x) * 0.38, y: c.apex.y + (p.y - c.apex.y) * 0.38 }));
  fillOutline(pen, core, pen.palette.water, 'none');
  fineRuns(pen, c.hex.map(p => [c.apex, p]));
  fineRuns(pen, [c.hex], true);
  finish.sheen(pen, [[c.hex[3]!, c.apex]]);
  // Engraved cuts shade lines only on the larger crystals, where they do not swallow the facets.
  if (finish.painter === 'stone' || c.r > 0.06) glyphEdges(pen, c.body, true);
  else pen.hand.line([c.body], 'outline', true);
}

/** A cluster of crystals fanning out of a lump of rock at the wall. */
export function crystals(pen: GlyphPen, _fit: GlyphFit, finish: Finish): void {
  const rock = pen.paint('rock');
  fillOutline(pen, MATRIX, rock.fill, 'none');
  pen.hand.grain(polyPath(MATRIX), 'rock');
  glyphSolid(pen, polyPath(MATRIX), centroid(MATRIX), 0.3, 0.9);
  glyphEdges(pen, MATRIX, true);
  for (const c of CRYSTALS) crystalPiece(pen, c, finish);
}

/** A fallen block: modelled whole, its fracture faces lit or shaded round the flat top it broke along. */
function blockPiece(pen: GlyphPen, b: Block, finish: Finish, cracked: boolean): void {
  const { outline, top } = b;
  fillOutline(pen, outline, pen.palette.fill, 'none');
  glyphSolid(pen, polyPath(outline), b.c, b.r, 0.9);
  const n = outline.length;
  const faces = outline.map((p, i) => {
    const q = outline[(i + 1) % n]!;
    const mid = { x: (p.x + q.x) / 2 - b.c.x, y: (p.y + q.y) / 2 - b.c.y };
    return { poly: [p, q, top[(i + 1) % n]!, top[i]!], out: mid };
  });
  splitByLight(pen, faces, finish, 0.2);
  finish.lit(pen, polyPath(top), 0.25);
  // The arrises between faces run from the top's corners down to the outline's.
  fineRuns(pen, [top], true, 0.85);
  fineRuns(pen, outline.map((p, i) => [top[i]!, p]).filter((_, i) => i % 2 === 0 || n < 9), false, 0.7);
  if (cracked) outlineRuns(pen, crack(b).slice(0, 1));
  if (cracked) fineRuns(pen, crack(b).slice(1));
  glyphEdges(pen, outline, true);
}

/** One or two blocks fallen from the roof, with the chips they broke off at their foot. */
export function boulder(pen: GlyphPen, _fit: GlyphFit, finish: Finish): void {
  for (const chip of CHIPS) fillOutline(pen, chip, pen.palette.fill, 'fine');
  for (const [i, b] of BOULDERS.entries()) blockPiece(pen, b, finish, i === BOULDERS.length - 1);
}

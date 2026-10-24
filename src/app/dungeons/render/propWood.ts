import type { PropKind } from '../model';
import { block, bothPainters, circlePath, disc, fineLines, fineRing, inkDot, roundedRect, strokeFine } from './glyphPen';
import type { PropGlyph } from './propShapes';

/** The props of wood and cloth, in the glyph family's grammar (`glyphPen.ts`). */

const BARREL_R = 0.27;
const CRATE = 0.58;
const CHEST = { w: 0.78, h: 0.52 };
const TAPESTRY = { half: 0.8, rod: 0.07, hem: -0.12, folds: 6 };

/** What is built of wood or woven: grain, boards and bands, a cloth's folds. */
export const WOOD_AND_CLOTH = {
  barrel: {
    material: 'wood',
    radius: 0.27,
    dome: true,
    lift: 0.6,
    silhouette: path => circlePath(path, BARREL_R),
    ...bothPainters(pen => {
      disc(pen, 0, 0, BARREL_R);
      const chime = BARREL_R - 0.065;
      fineRing(pen, 0, 0, chime);
      // The lid's boards.
      const seams: number[] = [];
      for (const x of [-0.1, 0, 0.1]) {
        const reach = Math.sqrt(chime * chime - x * x);
        seams.push(x, -reach, x, reach);
      }
      fineLines(pen, seams);
    }),
  },
  crate: {
    material: 'wood',
    radius: 0.3,
    lift: 0.5,
    silhouette: path => roundedRect(path, 0, 0, CRATE, CRATE),
    ...bothPainters(pen => {
      block(pen, 0, 0, CRATE, CRATE);
      const frame = CRATE / 2 - 0.07;
      pen.ctx.beginPath();
      roundedRect(pen.ctx, 0, 0, frame * 2, frame * 2, 0.015);
      pen.ctx.moveTo(-frame, frame);
      pen.ctx.lineTo(frame, -frame);
      strokeFine(pen);
    }),
  },
  chest: {
    material: 'wood',
    radius: 0.38,
    lift: 0.45,
    silhouette: path => roundedRect(path, 0, 0, CHEST.w, CHEST.h),
    ...bothPainters(pen => {
      const { ctx, palette } = pen;
      block(pen, 0, 0, CHEST.w, CHEST.h);
      // The lid's front edge, a little in from the box.
      const lid = -CHEST.h / 2 + 0.085;
      fineLines(pen, [-CHEST.w / 2, lid, CHEST.w / 2, lid]);
      ctx.fillStyle = palette.ink;
      for (const x of [-0.24, 0.24]) ctx.fillRect(x - 0.022, -CHEST.h / 2, 0.044, CHEST.h);
      ctx.beginPath();
      roundedRect(ctx, 0, -CHEST.h / 2 + 0.035, 0.11, 0.1, 0.02);
      ctx.fill();
    }),
  },
  throne: {
    material: 'wood',
    radius: 0.34,
    lift: 0.7,
    silhouette: path => roundedRect(path, 0, 0.02, 0.66, 0.62, 0.06),
    ...bothPainters(pen => {
      const { ctx } = pen;
      // A high back behind the seat, carved with a crest, its arms ending in knobs at the front.
      block(pen, 0, 0.21, 0.66, 0.24, pen.palette.fill, 0.05);
      ctx.beginPath();
      ctx.moveTo(-0.22, 0.25);
      ctx.quadraticCurveTo(0, 0.13, 0.22, 0.25);
      strokeFine(pen);
      block(pen, -0.26, -0.06, 0.1, 0.42, pen.palette.fill, 0.05);
      block(pen, 0.26, -0.06, 0.1, 0.42, pen.palette.fill, 0.05);
      block(pen, 0, -0.08, 0.42, 0.42, pen.cloth ?? pen.palette.fill, 0.04);
      // A tufted cushion.
      const c = 0.13;
      fineLines(pen, [-c, -0.08 - c, c, -0.08 + c, c, -0.08 - c, -c, -0.08 + c]);
      inkDot(pen, 0, -0.08, 0.025);
      inkDot(pen, -0.26, -0.24, 0.035);
      inkDot(pen, 0.26, -0.24, 0.035);
    }),
  },
  tapestry: {
    material: 'cloth',
    radius: 0.4,
    lift: 0,
    ...bothPainters(pen => {
      const { ctx, palette } = pen;
      const { half, rod, hem, folds } = TAPESTRY;
      const cloth = half - 0.06;
      const step = (cloth * 2) / folds;
      // The cloth hangs from the rod in soft folds.
      ctx.beginPath();
      ctx.moveTo(-cloth, rod);
      ctx.lineTo(-cloth, hem);
      for (let i = 0; i < folds; i++) {
        const x = -cloth + step * i;
        ctx.quadraticCurveTo(x + step / 2, hem - (i % 2 === 0 ? 0.06 : -0.02), x + step, hem);
      }
      ctx.lineTo(cloth, rod);
      ctx.closePath();
      ctx.fillStyle = palette.fill;
      ctx.fill();
      strokeFine(pen);
      const creases: number[] = [];
      for (let i = 1; i < folds; i++) creases.push(-cloth + step * i, rod, -cloth + step * i, hem + 0.01);
      fineLines(pen, creases);
      ctx.beginPath();
      ctx.moveTo(-half, rod);
      ctx.lineTo(half, rod);
      ctx.stroke();
      inkDot(pen, -half, rod, 0.04);
      inkDot(pen, half, rod, 0.04);
    }),
  },
} satisfies Partial<Record<PropKind, PropGlyph>>;

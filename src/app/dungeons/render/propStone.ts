import type { PropKind } from '../model';
import { bevel, block, circlePath, disc, fineLines, fineRing, inkDot, polygonPath, roundedRect, strokeFine } from './glyphPen';
import type { PropGlyph, PropPen } from './propShapes';

/** The props of stone and water, in the glyph family's grammar (`glyphPen.ts`). */

const FOUNTAIN_R = 0.5;
/** A well's outer radius at scale 1 (`scene/objectShadows.ts` outlines it). */
export const WELL_RADIUS = 0.4;
const WELL = { outer: WELL_RADIUS, inner: 0.25 };
/** The side of a statue's plinth at scale 1 (`scene/objectShadows.ts` outlines it). */
export const STATUE_PLINTH = 0.6;
const PLINTH = STATUE_PLINTH;
const SARCOPHAGUS = { w: 0.52, h: 0.94 };
const ALTAR = { w: 0.86, h: 0.44 };
const DAIS = { half: 1.5, depth: 1.35, chamfer: 0.32, step: 0.24 };

function octagon(r: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    points.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return points;
}

/** Broken arcs of ripple at radius `r`: `runs` pieces, each `share` of its sector, turned by `phase`. */
function ripples(pen: PropPen, r: number, runs: number, share: number, phase: number): void {
  const { ctx } = pen;
  ctx.beginPath();
  for (let i = 0; i < runs; i++) {
    const from = phase + (i * Math.PI * 2) / runs;
    const to = from + (share * Math.PI * 2) / runs;
    ctx.moveTo(Math.cos(from) * r, Math.sin(from) * r);
    ctx.arc(0, 0, r, from, to);
  }
  strokeFine(pen);
}

/** The dais' outline: a platform against the wall at y = 0 with its front corners cut, `inset` in from the lowest step. */
function daisStep(inset: number): number[] {
  const x = DAIS.half - inset;
  const y = -(DAIS.depth - inset);
  const c = DAIS.chamfer - inset * (2 - Math.SQRT2);
  return [-x, 0, -x, y + c, -x + c, y, x - c, y, x, y + c, x, 0];
}

/** An open polygon (its last edge is the wall, never inked), filled. */
function openStep(pen: PropPen, points: readonly number[], fine: boolean): void {
  const { ctx } = pen;
  ctx.beginPath();
  polygonPath(ctx, points);
  ctx.fillStyle = pen.palette.fill;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
  if (fine) strokeFine(pen);
  else ctx.stroke();
}

/** The sword carved on a sarcophagus' lid, its hilt towards the front. */
function effigySword(pen: PropPen): void {
  const { ctx } = pen;
  const hilt = -0.29;
  const guard = -0.2;
  const tip = 0.31;
  const blade = 0.035;
  ctx.beginPath();
  ctx.moveTo(-blade, guard);
  ctx.lineTo(-blade, tip - 0.07);
  ctx.lineTo(0, tip);
  ctx.lineTo(blade, tip - 0.07);
  ctx.lineTo(blade, guard);
  ctx.moveTo(-0.11, guard);
  ctx.lineTo(0.11, guard);
  ctx.moveTo(0, guard);
  ctx.lineTo(0, hilt);
  strokeFine(pen);
  inkDot(pen, 0, hilt - 0.02, 0.03);
}


/** What is cut from stone, bevelled, and the water some of it holds. */
export const STONE_AND_WATER = {
  fountain: {
    lift: 0.3,
    silhouette: ctx => polygonPath(ctx, octagon(FOUNTAIN_R)),
    draw: pen => {
      const { ctx, palette } = pen;
      ctx.beginPath();
      polygonPath(ctx, octagon(FOUNTAIN_R));
      ctx.fillStyle = palette.fill;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      polygonPath(ctx, octagon(FOUNTAIN_R - 0.085));
      ctx.fillStyle = palette.water;
      ctx.fill();
      strokeFine(pen);
      ripples(pen, 0.31, 3, 0.55, 0.4);
      ripples(pen, 0.21, 2, 0.6, 2.1);
      disc(pen, 0, 0, 0.11);
      inkDot(pen, 0, 0, 0.035);
    },
  },
  well: {
    lift: 0.35,
    silhouette: ctx => circlePath(ctx, WELL.outer),
    draw: pen => {
      const { ctx, palette } = pen;
      disc(pen, 0, 0, WELL.outer);
      disc(pen, 0, 0, WELL.inner, palette.water);
      // The shaft's far wall in shadow: a crescent of ink inside its rim.
      ctx.beginPath();
      ctx.arc(0, 0, WELL.inner, Math.PI * 0.6, Math.PI * 1.9);
      ctx.arc(0.045, 0.045, WELL.inner - 0.01, Math.PI * 1.9, Math.PI * 0.6, true);
      ctx.closePath();
      ctx.fillStyle = palette.ink;
      ctx.fill();
      // Joints between the stones of its ring.
      const joints: number[] = [];
      for (let i = 0; i < 11; i++) {
        const a = (i * Math.PI * 2) / 11 + 0.2;
        joints.push(Math.cos(a) * WELL.inner, Math.sin(a) * WELL.inner, Math.cos(a) * WELL.outer, Math.sin(a) * WELL.outer);
      }
      fineLines(pen, joints);
      // The windlass: an axle on two posts across the shaft.
      const post = (WELL.inner + WELL.outer) / 2;
      ctx.beginPath();
      roundedRect(ctx, 0, 0, post * 2, 0.06, 0.03);
      ctx.fillStyle = palette.fill;
      ctx.fill();
      strokeFine(pen);
      block(pen, -post, 0, 0.11, 0.11);
      block(pen, post, 0, 0.11, 0.11);
    },
  },
  statue: {
    lift: 1,
    silhouette: ctx => roundedRect(ctx, 0, 0, PLINTH, PLINTH),
    draw: pen => {
      block(pen, 0, 0, PLINTH, PLINTH);
      bevel(pen, 0, 0, PLINTH, PLINTH);
      drawStatueFigure(pen);
    },
  },
  sarcophagus: {
    lift: 0.45,
    silhouette: ctx => roundedRect(ctx, 0, 0, SARCOPHAGUS.w, SARCOPHAGUS.h),
    draw: pen => {
      block(pen, 0, 0, SARCOPHAGUS.w, SARCOPHAGUS.h);
      bevel(pen, 0, 0, SARCOPHAGUS.w, SARCOPHAGUS.h, 0.085);
      effigySword(pen);
    },
  },
  altar: {
    lift: 0.5,
    silhouette: ctx => roundedRect(ctx, 0, 0, ALTAR.w, ALTAR.h),
    draw: pen => {
      const { ctx, palette } = pen;
      block(pen, 0, 0, ALTAR.w, ALTAR.h);
      bevel(pen, 0, 0, ALTAR.w, ALTAR.h);
      // A cloth laid across it, hanging over front and back.
      const cloth = 0.11;
      const over = ALTAR.h / 2 + 0.05;
      ctx.beginPath();
      ctx.rect(-cloth, -over, cloth * 2, over * 2);
      ctx.fillStyle = pen.cloth ?? palette.fill;
      ctx.fill();
      strokeFine(pen);
      const candle = ALTAR.w / 2 - 0.15;
      for (const x of [-candle, candle]) {
        fineRing(pen, x, 0, 0.06);
        inkDot(pen, x, 0, 0.028);
      }
    },
  },
  dais: {
    lift: 0.15,
    draw: pen => {
      const outer = daisStep(0);
      const middle = daisStep(DAIS.step);
      const top = daisStep(DAIS.step * 2);
      openStep(pen, outer, false);
      openStep(pen, middle, true);
      openStep(pen, top, true);
      // Mitres where the steps turn at the cut corners.
      const mitres: number[] = [];
      for (const i of [2, 4, 6, 8]) mitres.push(outer[i]!, outer[i + 1]!, top[i]!, top[i + 1]!);
      fineLines(pen, mitres);
    },
  },
} satisfies Partial<Record<PropKind, PropGlyph>>;

/**
 * A statue's figure from above, facing −y: a cloaked warrior on a round base, shoulders broad, the
 * cloak falling behind, both hands on the hilt of a sword whose point rests before the feet.
 */
export function drawStatueFigure(pen: PropPen): void {
  const { ctx, palette } = pen;
  // Drawn at 1.25 of the numbers below: the figure fills its plinth.
  ctx.save();
  ctx.scale(FIGURE, FIGURE);
  const scaled = { ...pen, fine: pen.fine / FIGURE };
  ctx.lineWidth /= FIGURE;
  drawFigure(scaled, palette);
  ctx.restore();
}

const FIGURE = 1.25;

function drawFigure(pen: PropPen, palette: PropPen['palette']): void {
  const { ctx } = pen;
  disc(pen, 0, 0.02, 0.22);
  // The cloak, falling behind the shoulders in three folds.
  ctx.beginPath();
  ctx.moveTo(-0.19, -0.01);
  ctx.quadraticCurveTo(-0.22, 0.16, -0.12, 0.215);
  ctx.quadraticCurveTo(-0.06, 0.19, 0, 0.225);
  ctx.quadraticCurveTo(0.06, 0.19, 0.12, 0.215);
  ctx.quadraticCurveTo(0.22, 0.16, 0.19, -0.01);
  ctx.closePath();
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.stroke();
  fineLines(pen, [-0.06, 0.06, -0.07, 0.19, 0.06, 0.06, 0.07, 0.19]);
  // Shoulders and arms reaching forward to the hilt.
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.02);
  ctx.quadraticCurveTo(-0.2, -0.07, -0.12, -0.08);
  ctx.lineTo(-0.035, -0.13);
  ctx.lineTo(0.035, -0.13);
  ctx.lineTo(0.12, -0.08);
  ctx.quadraticCurveTo(0.2, -0.07, 0.2, 0.02);
  ctx.quadraticCurveTo(0, 0.09, -0.2, 0.02);
  ctx.closePath();
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.stroke();
  // The sword: guard across the hands, the blade's point resting before the feet.
  ctx.beginPath();
  ctx.moveTo(-0.022, -0.145);
  ctx.lineTo(-0.022, -0.27);
  ctx.lineTo(0, -0.3);
  ctx.lineTo(0.022, -0.27);
  ctx.lineTo(0.022, -0.145);
  ctx.closePath();
  ctx.fillStyle = palette.fill;
  ctx.fill();
  strokeFine(pen);
  fineLines(pen, [-0.075, -0.14, 0.075, -0.14]);
  disc(pen, 0, -0.005, 0.075);
  fineLines(pen, [0, -0.075, 0, 0.065]);
}

/** The figure alone, for a statue whose plinth is drawn apart from it. */
export const STATUE_FIGURE: PropGlyph = { lift: 1, draw: drawStatueFigure, silhouette: ctx => circlePath(ctx, 0.22 * FIGURE, 0, 0.02 * FIGURE) };

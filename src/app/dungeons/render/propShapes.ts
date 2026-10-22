import type { PropKind } from '../model';
import type { Canvas2D } from './geometry';
import type { Palette } from './palette';

/**
 * Atlas' own drawings of the props, in cells around the prop's centre, its front towards −y.
 * Each fills in the palette's fill or water and inks its outline with the context's current line width; `fine`
 * is the width of inner detail.
 */
export interface PropPen {
  ctx: Canvas2D;
  palette: Palette;
  fine: number;
}

type Draw = (pen: PropPen) => void;

function disc(pen: PropPen, x: number, y: number, r: number, fill: string): void {
  const { ctx } = pen;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

function box(pen: PropPen, x: number, y: number, w: number, h: number, fill: string): void {
  const { ctx } = pen;
  ctx.beginPath();
  ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

/** Thin inner lines, given as x0, y0, x1, y1 quadruples. */
function details(pen: PropPen, coords: readonly number[]): void {
  const { ctx } = pen;
  ctx.save();
  ctx.lineWidth = pen.fine;
  ctx.beginPath();
  for (let i = 0; i < coords.length; i += 4) {
    ctx.moveTo(coords[i]!, coords[i + 1]!);
    ctx.lineTo(coords[i + 2]!, coords[i + 3]!);
  }
  ctx.stroke();
  ctx.restore();
}

function ring(pen: PropPen, r: number): void {
  const { ctx } = pen;
  ctx.save();
  ctx.lineWidth = pen.fine;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function polygon(pen: PropPen, points: readonly number[], fill: string | null): void {
  const { ctx } = pen;
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
}

const COFFIN = [-0.16, -0.45, 0.16, -0.45, 0.25, -0.18, 0.18, 0.45, -0.18, 0.45, -0.25, -0.18];

const SHAPES: Record<PropKind, Draw> = {
  barrel: pen => {
    disc(pen, 0, 0, 0.25, pen.palette.fill);
    ring(pen, 0.19);
    ring(pen, 0.11);
  },
  crate: pen => {
    box(pen, 0, 0, 0.6, 0.6, pen.palette.fill);
    details(pen, [-0.3, -0.1, 0.3, -0.1, -0.3, 0.1, 0.3, 0.1]);
  },
  chest: pen => {
    box(pen, 0, 0, 0.8, 0.6, pen.palette.fill);
    details(pen, [-0.4, -0.08, 0.4, -0.08, -0.22, -0.3, -0.22, 0.3, 0.22, -0.3, 0.22, 0.3]);
  },
  fountain: pen => {
    disc(pen, 0, 0, 0.5, pen.palette.fill);
    disc(pen, 0, 0, 0.4, pen.palette.water);
    ring(pen, 0.25);
    disc(pen, 0, 0, 0.1, pen.palette.fill);
  },
  well: pen => {
    disc(pen, 0, 0, 0.4, pen.palette.fill);
    disc(pen, 0, 0, 0.24, pen.palette.water);
  },
  statue: pen => {
    disc(pen, 0, 0, 0.33, pen.palette.fill);
    const star: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 0.24 : 0.1;
      star.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    const { ctx } = pen;
    ctx.save();
    ctx.lineWidth = pen.fine;
    polygon(pen, star, pen.palette.ink);
    ctx.restore();
  },
  sarcophagus: pen => {
    polygon(pen, COFFIN, pen.palette.fill);
    const { ctx } = pen;
    ctx.save();
    ctx.lineWidth = pen.fine;
    polygon(pen, COFFIN.map(v => v * 0.72), null);
    ctx.restore();
  },
  altar: pen => {
    box(pen, 0, 0, 0.8, 0.4, pen.palette.fill);
    details(pen, [-0.3, -0.2, -0.3, 0.2, 0.3, -0.2, 0.3, 0.2]);
  },
  throne: pen => {
    box(pen, 0, 0.05, 0.5, 0.4, pen.palette.fill);
    box(pen, 0, 0.3, 0.6, 0.12, pen.palette.fill);
    details(pen, [-0.25, -0.05, -0.12, -0.05, 0.12, -0.05, 0.25, -0.05]);
  },
  dais: pen => {
    const { ctx } = pen;
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = pen.palette.fill;
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.lineWidth = pen.fine;
    ctx.beginPath();
    ctx.arc(0, 0, 1.25, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  tapestry: pen => {
    const { ctx } = pen;
    const width = 1.6;
    const scallops = 6;
    const r = width / scallops / 2;
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    for (let i = 0; i < scallops; i++) {
      const cx = -width / 2 + r * (2 * i + 1);
      ctx.arc(cx, 0, r, Math.PI, 0);
    }
    ctx.lineTo(width / 2, 0);
    ctx.stroke();
  },
};

/** Draws one prop at the origin; the caller has moved, turned and scaled the context. */
export function drawPropShape(kind: PropKind, pen: PropPen): void {
  SHAPES[kind](pen);
}

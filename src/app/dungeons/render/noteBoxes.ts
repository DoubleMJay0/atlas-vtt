import type { Canvas2D, Vec } from './geometry';
import type { Palette } from './palette';
import { roundRectPath, wrapText, type Rect } from './pageText';

/** A note's box, measured: its lines and size, in page pixels. */
export interface NoteBoxText {
  lines: string[];
  w: number;
  h: number;
}

export interface BoxLook {
  font: string;
  lineHeight: number;
  padding: number;
  radius: number;
  border: number;
  maxWidth: number;
}

export function measureNoteBox(ctx: Canvas2D, text: string, look: BoxLook): NoteBoxText {
  ctx.font = look.font;
  const lines = wrapText(ctx, text, look.maxWidth - look.padding * 2);
  const inner = lines.reduce((w, line) => Math.max(w, ctx.measureText(line).width), 0);
  return { lines, w: Math.ceil(inner + look.padding * 2), h: Math.ceil(lines.length * look.lineHeight + look.padding * 2) };
}

/**
 * A note box in paper with an ink border, optionally with a tail to `target`: box and tail are
 * stroked at twice the border and filled together, so the border runs round both as one shape.
 */
export function drawNoteBox(ctx: Canvas2D, box: Rect, text: NoteBoxText, look: BoxLook, palette: Palette, target: Vec | null): void {
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, box, look.radius);
  if (target) traceTail(ctx, box, target, look);
  ctx.lineJoin = 'round';
  ctx.lineWidth = look.border * 2;
  ctx.strokeStyle = palette.ink;
  ctx.stroke();
  ctx.fillStyle = palette.paper;
  ctx.fill();
  ctx.fillStyle = palette.ink;
  ctx.font = look.font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lead = (look.lineHeight - fontHeight(ctx)) / 2;
  text.lines.forEach((line, i) => ctx.fillText(line, box.x + look.padding, box.y + look.padding + lead + i * look.lineHeight));
  ctx.restore();
}

function fontHeight(ctx: Canvas2D): number {
  const m = ctx.measureText('Hg');
  return m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
}

/** A triangle with a base 20 px wide on the box's edge facing the target, its tip on the target. */
function traceTail(ctx: CanvasPath, box: Rect, target: Vec, look: BoxLook): void {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  if (Math.abs(dx) <= box.w / 2 && Math.abs(dy) <= box.h / 2) return;
  const half = look.radius;
  const inset = look.radius * 1.5;
  // Which edge the line to the target leaves through.
  const horizontal = Math.abs(dx) * box.h > Math.abs(dy) * box.w;
  let a: Vec;
  let b: Vec;
  if (horizontal) {
    const x = dx > 0 ? box.x + box.w - look.border : box.x + look.border;
    const y = clamp(cy + (dy * (box.w / 2)) / Math.abs(dx), box.y + inset, box.y + box.h - inset);
    a = { x, y: y - half };
    b = { x, y: y + half };
  } else {
    const y = dy > 0 ? box.y + box.h - look.border : box.y + look.border;
    const x = clamp(cx + (dx * (box.h / 2)) / Math.abs(dy), box.x + inset, box.x + box.w - inset);
    a = { x: x - half, y };
    b = { x: x + half, y };
  }
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(target.x, target.y);
  ctx.lineTo(b.x, b.y);
  ctx.closePath();
}

function clamp(v: number, lo: number, hi: number): number {
  return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
}

export interface LegendEntry {
  ref: string;
  room: number;
  text: string;
}

/** The legend's entries: number, then text wrapped to the width, hanging under the text. */
export function measureLegend(ctx: Canvas2D, entries: readonly LegendEntry[], font: string, width: number, lineHeight: number): { lines: { number: string | null; text: string }[][]; height: number; indent: number } {
  ctx.font = font;
  const indent = entries.reduce((w, e) => Math.max(w, ctx.measureText(`${e.ref}. `).width), 0);
  const lines = entries.map(e => wrapText(ctx, e.text, width - indent).map((text, i) => ({ number: i === 0 ? `${e.ref}.` : null, text })));
  const rows = lines.reduce((n, entry) => n + entry.length, 0);
  return { lines, height: rows * lineHeight + Math.max(0, entries.length - 1) * lineHeight * 0.5, indent };
}

/** Draws the legend with its top-left at `at`; returns each entry's rectangle. */
export function drawLegend(ctx: Canvas2D, legend: ReturnType<typeof measureLegend>, at: Vec, width: number, font: string, lineHeight: number, ink: string): Rect[] {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = ink;
  ctx.textBaseline = 'top';
  let y = at.y;
  const rects: Rect[] = [];
  for (const entry of legend.lines) {
    const top = y;
    for (const line of entry) {
      if (line.number) {
        ctx.textAlign = 'right';
        ctx.fillText(line.number, at.x + legend.indent - ctx.measureText(' ').width, y);
      }
      ctx.textAlign = 'left';
      ctx.fillText(line.text, at.x + legend.indent, y);
      y += lineHeight;
    }
    rects.push({ x: at.x, y: top, w: width, h: y - top });
    y += lineHeight * 0.5;
  }
  ctx.restore();
  return rects;
}

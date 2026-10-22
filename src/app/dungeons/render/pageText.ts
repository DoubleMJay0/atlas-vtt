import type { Canvas2D } from './geometry';

/** A screen rectangle, in page pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Breaks text into lines no wider than `width` (a word longer than that keeps a line alone). */
export function wrapText(ctx: Canvas2D, text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Wraps as narrow as the text allows without taking another line, so the lines come out of
 * about equal length instead of a long block and a short last line.
 */
export function balancedWrap(ctx: Canvas2D, text: string, maxWidth: number): string[] {
  const lines = wrapText(ctx, text, maxWidth);
  if (lines.length < 2) return lines;
  let lo = 0;
  let hi = maxWidth;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (wrapText(ctx, text, mid).length > lines.length) lo = mid;
    else hi = mid;
  }
  return wrapText(ctx, text, hi);
}

export function widestLine(ctx: Canvas2D, lines: readonly string[]): number {
  return lines.reduce((w, line) => Math.max(w, ctx.measureText(line).width), 0);
}

/** Draws lines centred on `cx`, the first line's top at `top`; returns the bottom. */
export function drawCentredLines(ctx: Canvas2D, lines: readonly string[], cx: number, top: number, lineHeight: number): number {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineHeight));
  return top + lines.length * lineHeight;
}

/** A rounded rectangle as a closed subpath. */
export function roundRectPath(ctx: CanvasPath, r: Rect, radius: number): void {
  const k = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
  ctx.moveTo(r.x + k, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k);
  ctx.closePath();
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

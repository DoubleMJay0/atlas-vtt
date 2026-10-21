import { Container, Graphics, Text } from 'pixi.js';
import type { Point } from '../../grid/hexGeometry';
import { canvasBadgeColors, isDarkTheme } from './canvasBadgeColors';
import { CANVAS_INK, INK_SHADE } from './canvasInk';
import { destroyTree } from './destroyTree';

/** The distance label's look, in screen pixels. */
export const LABEL_LOOK = {
  fontSize: 12,
  /** Room between the text and the pill's edge, the same on every side. */
  padding: 6,
  /** The pill's border. */
  border: 1,
  /** Map left between the label and the line, or the token it must not cover. */
  gap: 6,
  /** The radius of the dots marking a measurement's points; the label keeps clear of them too. */
  dot: 4,
} as const;

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A circle the label must not cover, in the same units as the path it is placed by. */
export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/**
 * Where a label goes: beside a path (clear of its line and dots, and of `avoid`, in world units), or
 * centred over a point (inside a measured area, where no line runs).
 */
export type LabelTarget =
  | { readonly beside: readonly Point[]; readonly avoid?: Circle | null }
  | { readonly over: Point };

/** The pill around a text of `text`'s size: equal padding all round, ends fully rounded, whole pixels. */
export function pillSize(text: Size): Size & { readonly radius: number } {
  const height = Math.ceil(text.height + 2 * LABEL_LOOK.padding);
  const width = Math.max(height, Math.ceil(text.width + 2 * LABEL_LOOK.padding));
  return { width, height, radius: height / 2 };
}

/** The label's colours: the canvas badges' (pins, nameplates), with an opaque border mixed from them. */
export function labelColors(): { readonly text: number; readonly background: number; readonly border: number } {
  const { background, stroke } = canvasBadgeColors();
  return { text: stroke, background, border: mix(background, stroke, isDarkTheme() ? 0.25 : 0.2) };
}

function mix(from: number, to: number, share: number): number {
  const channel = (shift: number): number => Math.round(((from >> shift) & 0xff) * (1 - share) + ((to >> shift) & 0xff) * share);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** The point halfway along a path's length, and the direction of the segment it lies on (null without length). */
export function pathMiddle(points: readonly Point[]): { readonly point: Point; readonly direction: Point | null } | null {
  const first = points[0];
  if (!first) return null;
  const lengths = points.slice(1).map((end, i) => Math.hypot(end.x - points[i]!.x, end.y - points[i]!.y));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (const [i, length] of lengths.entries()) {
    const start = points[i]!;
    const end = points[i + 1]!;
    if (length > 0 && remaining <= length) {
      const t = remaining / length;
      return {
        point: { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t },
        direction: { x: (end.x - start.x) / length, y: (end.y - start.y) / length },
      };
    }
    remaining -= length;
  }
  return { point: first, direction: null };
}

/** How far a box of `size` reaches from its middle along the unit vector `n`. */
function reach(size: Size, n: Point): number {
  return (Math.abs(n.x) * size.width + Math.abs(n.y) * size.height) / 2;
}

/** The distance from a circle's centre to the nearest point of a box of `size` centred on `center`. */
function distanceToBox(circle: Circle, center: Point, size: Size): number {
  const dx = Math.max(Math.abs(circle.x - center.x) - size.width / 2, 0);
  const dy = Math.max(Math.abs(circle.y - center.y) - size.height / 2, 0);
  return Math.hypot(dx, dy);
}

/**
 * Where a label of `size` stands beside `path` (screen pixels): at the path's middle, moved off the
 * line along its normal (the upper side, or the right of an upright line) until it clears the line,
 * its dots and, if given, `avoid` (the token a drag ruler measures) by `LABEL_LOOK.gap`. A path
 * without length takes the label above its point.
 */
export function placeLabel(path: readonly Point[], size: Size, avoid: Circle | null = null): Point | null {
  const middle = pathMiddle(path);
  if (!middle) return null;
  const along = middle.direction ?? { x: 1, y: 0 };
  let normal = { x: along.y, y: -along.x };
  if (normal.y > 1e-9 || (Math.abs(normal.y) <= 1e-9 && normal.x < 0)) normal = { x: -normal.x, y: -normal.y };
  const clearance = LABEL_LOOK.dot + CANVAS_INK.keyline + LABEL_LOOK.gap;
  let distance = reach(size, normal) + clearance;
  const at = (offset: number): Point => ({ x: middle.point.x + normal.x * offset, y: middle.point.y + normal.y * offset });
  if (avoid) {
    // The token lies along the line, so stepping away from the line always clears it.
    const limit = distance + 2 * (avoid.radius + LABEL_LOOK.gap) + size.width + size.height;
    while (distance < limit && distanceToBox(avoid, at(distance), size) < avoid.radius + LABEL_LOOK.gap) distance += 1;
  }
  return at(distance);
}

/** Where a label of `size` stands for `target`, in screen pixels at `zoom`. */
export function labelCenter(target: LabelTarget, size: Size, zoom: number): Point | null {
  const screen = ({ x, y }: Point): Point => ({ x: x * zoom, y: y * zoom });
  if ('over' in target) return screen(target.over);
  const avoid = target.avoid ? { ...screen(target.avoid), radius: target.avoid.radius * zoom } : null;
  return placeLabel(target.beside.map(screen), size, avoid);
}

/**
 * A measurement's distance on a pill, at a constant size on screen: it lies in a container scaled
 * back from the world, its text is rasterised at the renderer's resolution (the text's own default)
 * and snapped to device pixels, so it is as sharp as any text of the interface at every zoom.
 */
export class MeasureLabel {
  readonly view = new Container({ label: 'measure-label', eventMode: 'none', interactiveChildren: false });
  readonly text = new Text({
    text: '',
    anchor: 0.5,
    roundPixels: true,
    style: { fontFamily: FONT_FAMILY, fontSize: LABEL_LOOK.fontSize, fontWeight: '600', fill: 0xffffff },
  });
  private readonly pill = new Graphics();
  private target: LabelTarget | null = null;

  constructor() {
    this.view.addChild(this.pill, this.text);
  }

  /** Shows `distance` at `target` (world units), at `zoom`. */
  show(distance: string, target: LabelTarget, zoom: number): void {
    if (this.text.text !== distance) this.text.text = distance;
    this.target = target;
    this.redraw(zoom);
  }

  /** Draws the label again where it stands: the zoom or the theme changed. */
  redraw(zoom: number): void {
    const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    const colors = labelColors();
    if (this.text.style.fill !== colors.text) this.text.style.fill = colors.text;
    const size = pillSize(this.text.getLocalBounds());
    this.drawPill(size, colors);
    const center = this.target && labelCenter(this.target, size, scale);
    if (!center) return;
    this.view.scale.set(1 / scale);
    this.view.position.set(center.x / scale, center.y / scale);
  }

  destroy(): void {
    destroyTree(this.view);
  }

  /** The pill, opaque, with the ink's soft shade beside it: no translucent piece lies over another. */
  private drawPill({ width, height, radius }: Size & { radius: number }, colors: ReturnType<typeof labelColors>): void {
    const g = this.pill.clear();
    let edge = 0;
    for (const band of INK_SHADE) {
      const grow = edge + band.width / 2;
      g.roundRect(-width / 2 - grow, -height / 2 - grow, width + 2 * grow, height + 2 * grow, radius + grow)
        .stroke({ width: band.width, color: 0x000000, alpha: band.alpha });
      edge += band.width;
    }
    const inset = LABEL_LOOK.border;
    g.roundRect(-width / 2, -height / 2, width, height, radius).fill(colors.border);
    g.roundRect(-width / 2 + inset, -height / 2 + inset, width - 2 * inset, height - 2 * inset, radius - inset).fill(colors.background);
  }
}

/** Calls `redraw` whenever Obsidian switches between its light and dark theme; returns what stops it. */
export function watchMeasureLabelTheme(redraw: () => void): () => void {
  let dark = isDarkTheme();
  const observer = new MutationObserver(() => {
    if (isDarkTheme() === dark) return;
    dark = isDarkTheme();
    redraw();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

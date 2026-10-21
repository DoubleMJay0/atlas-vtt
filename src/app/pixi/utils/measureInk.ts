import { AlphaFilter, Container, Graphics } from 'pixi.js';
import type { Point } from '../../grid/hexGeometry';
import { CANVAS_INK, INK_SHADE, type InkBand } from './canvasInk';
import { destroyTree } from './destroyTree';

/** Opacity of a measured area's fill: present, never hiding the map. */
const AREA_ALPHA = 0.14;

/** The middle of a ring dot: white, as the handles of a selected token. */
const HOLLOW_MIDDLE = 0xffffff;

/** Builds a path in screen pixels on `graphics`, ready to stroke or fill. */
export type InkTrace = (graphics: Graphics) => void;

/** The dark bands about a line of `stroke` screen pixels, outermost first: the shade, then the dark line. */
export function darkBands(stroke: number): InkBand[] {
  const keyline = stroke + 2 * CANVAS_INK.keyline;
  let reach = 0;
  const shade = INK_SHADE.map((band) => {
    reach += band.width;
    return { width: keyline + 2 * reach, alpha: band.alpha };
  });
  return [...shade.reverse(), { width: keyline, alpha: CANVAS_INK.keylineAlpha }];
}

/**
 * A measurement drawn in the ink of the selection highlight, at its size on screen: `begin` scales it
 * to the zoom, and the drawing calls take world points. Three layers keep translucent pieces from
 * adding up where they meet (at a joint, where a dot sits on the line, where a cone's edges join its
 * arc): an area's fill is one shape beneath; the dark bands are drawn with max blending, so a pixel
 * takes the darkest band over it and never their sum; the accent above them is opaque. Max blending
 * needs an empty surface, so the bands and the accent are composed in a layer of their own (a
 * pass-through filter) and laid onto the map as one, as the laser is.
 */
export class MeasureInk {
  readonly view = new Container({ label: 'measure', eventMode: 'none', interactiveChildren: false });
  private readonly area = new Graphics({ label: 'measure-area' });
  private readonly layer = new Container({ label: 'measure-ink' });
  private readonly dark = new Graphics({ label: 'measure-dark', blendMode: 'max' });
  private readonly accent = new Graphics({ label: 'measure-accent' });
  private readonly composite = new AlphaFilter({ alpha: 1, resolution: 'inherit', antialias: 'inherit' });
  private zoom = 1;

  constructor() {
    this.layer.filters = [this.composite];
    this.layer.addChild(this.dark, this.accent);
    this.view.addChild(this.area, this.layer);
  }

  /** Clears the drawing and sizes what follows for `zoom` (screen pixels per world unit). */
  begin(zoom: number): void {
    this.zoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    this.view.scale.set(1 / this.zoom);
    this.clear();
  }

  clear(): void {
    this.area.clear();
    this.dark.clear();
    this.accent.clear();
  }

  /** Where a world point lies in the drawing's screen pixels. */
  screen(point: Point): Point {
    return { x: point.x * this.zoom, y: point.y * this.zoom };
  }

  /** Strokes `trace` as the accent line, held by its dark bands. */
  line(trace: InkTrace, color: number): void {
    for (const band of darkBands(CANVAS_INK.stroke)) {
      trace(this.dark);
      this.dark.stroke({ width: band.width, color: 0x000000, alpha: band.alpha, cap: 'round', join: 'round' });
    }
    trace(this.accent);
    this.accent.stroke({ width: CANVAS_INK.stroke, color, cap: 'round', join: 'round' });
  }

  /**
   * A dot of `radius` screen pixels at the world point, in the same ink as the line it sits on; a
   * `hollow` one is a ring of the line's width around a white middle.
   */
  dot(point: Point, radius: number, color: number, hollow = false): void {
    const { x, y } = this.screen(point);
    for (const band of darkBands(2 * radius)) this.dark.circle(x, y, band.width / 2).fill({ color: 0x000000, alpha: band.alpha });
    this.accent.circle(x, y, radius).fill(color);
    if (hollow) this.accent.circle(x, y, radius - CANVAS_INK.stroke).fill(HOLLOW_MIDDLE);
  }

  /** Fills `trace` with a light, even wash of `color`. */
  fill(trace: InkTrace, color: number): void {
    trace(this.area);
    this.area.fill({ color, alpha: AREA_ALPHA });
  }

  destroy(): void {
    destroyTree(this.view);
    this.composite.destroy();
  }
}

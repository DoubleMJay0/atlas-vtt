/**
 * Graphics of the token drag ruler: the path stands above the lighting, so the dark never
 * covers it, and ends at the dragged token's rim; the distance label sits halfway along
 * the path, above the token UI so bars and nameplates never hide it.
 */

import { Container, Graphics } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { Point } from '../../grid/hexGeometry';
import type { HideableLayer } from '../playerSafeFrame';
import { MAP_LAYER_Z } from '../mapLayerOrder';
import { cssColorToHexNumber, getObsidianAccentColor } from '../utils/colorUtils';
import { destroyTree } from '../utils/destroyTree';
import { createMeasureLabelText, drawMeasureLabel, drawMeasurePath, drawMeasurePoint, measureLabelFontSize, pathMidpoint, shortenPathEnd, watchMeasureLabelTheme } from '../utils/measureDrawing';

/** Above token UI (100) and text (500), below drawings, vision and fog. */
const LABEL_Z_INDEX = 800;

export class DragRulerView {
  private readonly path = new Graphics();
  private readonly label = new Container();
  private readonly pill = new Graphics();
  private readonly text = createMeasureLabelText();
  /** Where the label stands while the ruler shows; a theme change redraws it there. */
  private labelCenter: Point | null = null;
  private readonly stopThemeWatch = watchMeasureLabelTheme(() => {
    if (this.labelCenter) drawMeasureLabel(this.pill, this.text, this.labelCenter, this.viewport.scale.x);
  });

  constructor(private readonly viewport: Viewport) {
    this.path.eventMode = 'none';
    this.label.eventMode = 'none';
    this.path.zIndex = MAP_LAYER_Z.measure;
    this.label.zIndex = LABEL_Z_INDEX;
    this.label.addChild(this.pill, this.text);
    this.viewport.addChild(this.path, this.label);
    this.clear();
  }

  /** Draws the path through `points` with `distance` labelled at its middle, ending `endGap` before its end (the dragged token's rim). */
  draw(points: readonly Point[], distance: string, endGap = 0): void {
    const middle = pathMidpoint(points);
    if (!middle) return;
    const accent = cssColorToHexNumber(getObsidianAccentColor());
    const scale = this.viewport.scale.x;

    this.path.clear();
    // The path stands above the tokens, so it stops at the dragged token instead of crossing it.
    drawMeasurePath(this.path, accent, shortenPathEnd(points, endGap));
    // The origin and waypoints stay marked.
    for (const point of points.slice(0, -1)) drawMeasurePoint(this.path, accent, point);

    this.text.text = distance;
    this.text.style.fontSize = measureLabelFontSize(scale);
    drawMeasureLabel(this.pill, this.text, middle, scale);
    this.labelCenter = middle;

    this.path.visible = true;
    this.label.visible = true;
  }

  clear(): void {
    this.path.clear();
    this.pill.clear();
    this.labelCenter = null;
    this.path.visible = false;
    this.label.visible = false;
  }

  get layers(): HideableLayer[] {
    return [this.path, this.label];
  }

  destroy(): void {
    this.stopThemeWatch();
    destroyTree(this.path);
    destroyTree(this.label);
  }
}

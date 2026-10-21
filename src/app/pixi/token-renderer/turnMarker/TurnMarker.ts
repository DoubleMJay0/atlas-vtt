import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { MOTION_NORMAL_MS } from '../../../utils/motion';
import type { LayerVisibility } from '../../playerSafeFrame';
import { destroyTree } from '../../utils/destroyTree';
import { ValueTransition } from '../../utils/ValueTransition';
import type { TokenGroupContainer } from '../types';
import { MARKER_GROW_MS, TURN_LOOK, arcLayout, arcPolygons, glowExtent, markerAppearance, type ArcPoint, type GlowExtent } from './turnMarkerShape';

/** Where the markers get their glow textures, shared between markers of one shape. */
export interface GlowTextureSource {
  take(extent: GlowExtent): { key: string; texture: Texture | null };
  release(key: string): void;
  destroy(): void;
}

/** Runs `transition` to `value`, or sets it at once. */
function settle(transition: ValueTransition, value: number, animate: boolean): void {
  if (animate) transition.animateTo(value);
  else transition.jumpTo(value);
}

/** Adds `polygons` to `graphics` as closed shapes, for one fill. */
function tracePolygons(graphics: Graphics, polygons: readonly ArcPoint[][]): void {
  for (const polygon of polygons) graphics.poly(polygon.flatMap(({ x, y }) => [x, y]), true);
}

/**
 * The marker on one token: the glow, a texture scaled with the map like the ground it lies on, and
 * the arcs, laid out in the map's proportions but drawn in screen pixels inside a container scaled
 * back by the zoom, so PIXI builds their curves from as many pieces as they have on screen. It
 * lands as the turn comes and follows its token. While the GM has the token selected the
 * selection's line is its crisp edge, and the arcs step aside.
 */
export class TurnMarker {
  readonly view = new Container({ label: 'turnMarker', eventMode: 'none' });
  /** The glow twice over: laid over the map, which tints a light map, and added to it, which lights a dark one. */
  private readonly glows = [
    new Sprite({ anchor: 0.5, alpha: TURN_LOOK.glowTint, visible: false }),
    new Sprite({ anchor: 0.5, alpha: TURN_LOOK.glowLight, blendMode: 'add', visible: false }),
  ] as const;
  private readonly arcs = new Container({ label: 'turnArcs' });
  private readonly ink = new Graphics();
  private glowKey: string | null = null;
  private glowDrawn = '';
  private arcsDrawn = '';
  /** How far the marker has landed, 0 to 1: its scale, opacity and the arcs' turn follow it. */
  growth = 1;
  private readonly grow: ValueTransition;
  private readonly arcsFade = new ValueTransition(1, MOTION_NORMAL_MS, (value) => { this.arcs.alpha = value; });
  private selected = false;

  constructor(private readonly textures: GlowTextureSource) {
    this.arcs.addChild(this.ink);
    this.view.addChild(...this.glows, this.arcs);
    this.grow = new ValueTransition(1, MARKER_GROW_MS, (value) => this.land(value));
  }

  /**
   * Draws the marker for a token whose edge lies `outerRadius` world units from its middle, at
   * `unit` world units per UI unit and `zoom` screen pixels per world unit; nothing when unchanged.
   */
  draw(outerRadius: number, unit: number, zoom: number, accent: number, force = false): void {
    const glowKey = `${outerRadius}|${unit}`;
    if (force || glowKey !== this.glowDrawn) {
      this.glowDrawn = glowKey;
      this.paintGlow(glowExtent(outerRadius, unit));
    }
    for (const glow of this.glows) if (glow.tint !== accent) glow.tint = accent;
    const arcsKey = `${outerRadius}|${unit}|${zoom}|${accent}`;
    if (!force && arcsKey === this.arcsDrawn) return;
    this.arcsDrawn = arcsKey;
    this.arcs.scale.set(1 / zoom);
    const { radius, width, keyline } = arcLayout(outerRadius, unit, zoom);
    this.ink.clear();
    tracePolygons(this.ink, arcPolygons(radius, width + 2 * keyline, keyline));
    this.ink.fill({ color: 0x000000, alpha: TURN_LOOK.keylineAlpha });
    tracePolygons(this.ink, arcPolygons(radius, width));
    this.ink.fill({ color: accent });
  }

  /** Lands as the turn comes, or shows at once. */
  growIn(animate: boolean): void {
    if (!animate) {
      this.grow.jumpTo(1);
      return;
    }
    this.grow.jumpTo(0);
    this.grow.animateTo(1);
  }

  /** Whether the GM has the token selected: the arcs fade out under the selection's line, and back. */
  select(selected: boolean, animate: boolean): void {
    if (selected === this.selected) return;
    this.selected = selected;
    settle(this.arcsFade, selected ? 0 : 1, animate);
  }

  /** Stands where `sprite` stands, shown with it, as translucent as it is and as far landed as it is. */
  follow(sprite: TokenGroupContainer | null): void {
    const visible = sprite !== null && sprite.visible;
    if (this.view.visible !== visible) this.view.visible = visible;
    if (!sprite) return;
    if (this.view.x !== sprite.x || this.view.y !== sprite.y) this.view.position.copyFrom(sprite.position);
    const alpha = sprite.alpha * markerAppearance(this.growth).alpha;
    if (this.view.alpha !== alpha) this.view.alpha = alpha;
  }

  /** The marker in the players' frame: as far landed as on the canvas, with its arcs, since players see no selection. */
  playerLayers(visible: boolean): LayerVisibility[] {
    return [
      { layer: this.view, visible, alpha: markerAppearance(this.growth).alpha },
      { layer: this.arcs, visible: true, alpha: 1 },
    ];
  }

  destroy(): void {
    this.grow.cancel();
    this.arcsFade.cancel();
    if (this.glowKey !== null) this.textures.release(this.glowKey);
    this.glowKey = null;
    destroyTree(this.view);
  }

  private paintGlow(extent: GlowExtent): void {
    const previous = this.glowKey;
    const { key, texture } = this.textures.take(extent);
    this.glowKey = key;
    if (previous !== null) this.textures.release(previous);
    for (const glow of this.glows) {
      glow.visible = texture !== null;
      if (!texture) continue;
      glow.texture = texture;
      glow.width = 2 * extent.radius;
      glow.height = 2 * extent.radius;
    }
  }

  private land(growth: number): void {
    this.growth = growth;
    const look = markerAppearance(growth);
    this.view.scale.set(look.scale);
    this.arcs.rotation = look.turn;
  }
}

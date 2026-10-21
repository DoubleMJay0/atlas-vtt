import { Circle, Container, Graphics, Sprite, Texture, type FederatedPointerEvent, type Text } from 'pixi.js';
import { MOTION_NORMAL_MS } from '../../utils/motion';
import { MAP_LAYER_Z } from '../mapLayerOrder';
import { paintRotateHandle, rotateIconTexture, ROTATE_ICON_SHARE } from '../rotateHandleLook';
import { destroyTree } from '../utils/destroyTree';
import { isDarkTheme } from '../utils/canvasBadgeColors';
import { createMeasureLabelText, drawMeasureLabel } from '../utils/measureDrawing';
import { ValueTransition } from '../utils/ValueTransition';
import type { Box } from './selectionGeometry';
import { drawGroupStem } from './selectionInk';
import { turnLabel } from './groupTurn';

/** The button's look, in screen pixels. */
const LOOK = {
  /** The disc, a little larger than a token's own rotate handle: it turns a whole group. */
  radius: 12,
  /** What a press may miss the disc by and still take it. */
  reach: 4,
  /** From the frame's top edge to the disc. */
  stem: 12,
  /** From the disc to the angle shown while turning. */
  labelGap: 6,
} as const;

export interface GroupRotateButtonDeps {
  /** The theme's accent, in which the stem is drawn. */
  accent(): number;
  reducedMotion(): boolean;
  /** A primary press on the button. */
  press(event: FederatedPointerEvent): void;
}

/**
 * The round button on a short stem above the frame of a group selection that turns the group, as
 * Owlbear Rodeo's does. Laid out in screen pixels in a container scaled back to the world, so it
 * keeps its size at every zoom. While the group turns, its arm turns about the frame's centre with
 * it and shows the angle; the disc, its glyph and the angle stay upright.
 */
export class GroupRotateButton {
  readonly layer = new Container({ label: 'groupRotate', zIndex: MAP_LAYER_Z.groupRotate, visible: false });
  private readonly arm = new Container();
  private readonly stem = new Graphics();
  private readonly handle = new Container({ label: 'groupRotateHandle', eventMode: 'static', cursor: 'grab' });
  private readonly disc = new Graphics();
  private readonly glyph = new Sprite();
  private readonly label = new Container({ visible: false });
  private readonly pill = new Graphics();
  /** Made when an angle is first shown: a text reads the theme. */
  private text: Text | null = null;
  private readonly fade = new ValueTransition(1, MOTION_NORMAL_MS, (value) => { this.layer.alpha = value; });
  private hovered = false;
  private held = false;
  private drawn = '';
  private labelDrawn = '';
  private accent = 0;
  private glyphDark: boolean | null = null;
  private destroyed = false;

  constructor(private readonly deps: GroupRotateButtonDeps) {
    this.handle.hitArea = new Circle(0, 0, LOOK.radius + LOOK.reach);
    this.glyph.anchor.set(0.5);
    this.handle.addChild(this.disc, this.glyph);
    this.label.addChild(this.pill);
    this.arm.addChild(this.stem, this.handle, this.label);
    this.layer.addChild(this.arm);
    this.handle.on('pointerover', () => this.setHovered(true));
    this.handle.on('pointerout', () => this.setHovered(false));
    this.handle.on('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      deps.press(event);
    });
  }

  /**
   * Stands above `frame` (world units) at `zoom`, turned `turn` degrees about the frame's centre
   * with the angle shown, or upright without one; hidden for a null frame.
   */
  show(frame: Box | null, zoom: number, turn: number | null = null): void {
    if (!frame) {
      this.layer.visible = false;
      this.fade.cancel();
      return;
    }
    if (!this.layer.visible) {
      this.layer.visible = true;
      this.accent = this.deps.accent();
      this.fade.jumpTo(this.deps.reducedMotion() ? 1 : 0);
      if (this.layer.alpha < 1) this.fade.animateTo(1);
    }
    if (isDarkTheme() !== this.glyphDark) {
      this.accent = this.deps.accent();
      this.paint();
    }
    this.arm.position.set(frame.x + frame.width / 2, frame.y + frame.height / 2);
    this.arm.scale.set(1 / zoom);
    const radians = ((turn ?? 0) * Math.PI) / 180;
    this.arm.rotation = radians;
    this.handle.rotation = -radians;
    this.label.rotation = -radians;

    const top = -(frame.height * zoom) / 2;
    const handleY = top - LOOK.stem - LOOK.radius;
    this.handle.position.set(0, handleY);
    this.label.visible = turn !== null;
    const label = turn === null ? '' : turnLabel(turn);
    if (label !== '' && label !== this.labelDrawn) {
      const text = this.text ?? this.label.addChild(this.text = createMeasureLabelText());
      text.text = label;
      drawMeasureLabel(this.pill, text, { x: 0, y: 0 }, 1);
    }
    this.labelDrawn = label;
    // The angle stands outward of the disc, upright: as far out as the pill reaches along the arm's way
    const { width, height } = this.pill.getLocalBounds();
    const reach = (Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height) / 2;
    this.label.position.set(0, handleY - LOOK.radius - LOOK.labelGap - reach);
    const key = `${top}|${this.accent}`;
    if (key !== this.drawn) {
      this.drawn = key;
      this.stem.clear();
      drawGroupStem(this.stem, top, top - LOOK.stem, this.accent);
    }
  }

  /** Whether the button is held while it turns the group: it keeps its pressed look until let go. */
  setHeld(held: boolean): void {
    this.held = held;
    this.handle.cursor = held ? 'grabbing' : 'grab';
    this.paint();
  }

  /** Paints the disc and glyph again in the current theme. */
  paint(): void {
    if (this.destroyed) return;
    const emphasised = this.hovered || this.held;
    paintRotateHandle(this.disc, LOOK.radius, emphasised);
    this.handle.scale.set(this.held ? 0.94 : 1);
    this.labelDrawn = '';
    const dark = isDarkTheme();
    if (dark !== this.glyphDark) {
      this.glyphDark = dark;
      void this.loadGlyph(dark);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.fade.cancel();
    const texture = this.glyph.texture;
    destroyTree(this.layer);
    if (texture !== Texture.EMPTY && !texture.destroyed) texture.destroy(true);
  }

  private setHovered(hovered: boolean): void {
    this.hovered = hovered;
    this.paint();
  }

  private async loadGlyph(dark: boolean): Promise<void> {
    try {
      const texture = await rotateIconTexture(dark);
      if (this.destroyed || this.glyphDark !== dark) {
        texture.destroy(true);
        return;
      }
      const previous = this.glyph.texture;
      this.glyph.texture = texture;
      this.glyph.scale.set((2 * LOOK.radius * ROTATE_ICON_SHARE) / texture.width);
      if (previous !== Texture.EMPTY && !previous.destroyed) previous.destroy(true);
    } catch (error) {
      console.error('[GroupRotateButton] Could not draw the rotate glyph:', error);
    }
  }
}

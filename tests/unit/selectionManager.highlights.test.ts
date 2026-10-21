import { EventEmitter } from 'events';
import { describe, expect, it } from 'vitest';
import { Container, Sprite, type Graphics } from 'pixi.js';
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import { SelectionManager } from '../../src/app/pixi/SelectionManager';
import { HIGHLIGHT_EDGE, SELECTION_LOOK } from '../../src/app/pixi/selection/selectionGeometry';

/** A token group at (x, y) with art 70 px wide and the ring every token has by default (78 px across). */
function token(x: number, y: number): Container {
  const group = new Container();
  const sprite = group.addChild(new Sprite());
  sprite.label = 'tokenSprite';
  sprite.width = 70;
  sprite.height = 70;
  group.position.set(x, y);
  return group;
}

function setup(selectedIds: string[]) {
  const tokens = { goblin: token(100, 100), orc: token(300, 100) };
  const viewport = Object.assign(new Container(), { toWorld: (point: { x: number; y: number }) => point });
  const store = createStore(subscribeWithSelector(() => ({
    selectedIds, activeTool: 'select', selectionMode: 'box',
    objects: { tokens: { goblin: { id: 'goblin' }, orc: { id: 'orc' } }, drawings: {} },
  })));
  const manager = new SelectionManager(viewport as never, () => tokens, () => ({}), store as never, new EventEmitter());
  manager.barsProvider = () => ({ halfWidth: 50, reach: 24 });
  manager.updateSelectionOverlay();
  const layer = manager.getPlayerViewLayers()[0]!.layer as Container;
  const highlights = (): Container[] => layer.children.filter((child) => child.label === 'selectionHighlight');
  const group = layer.children.find((child) => child.label === 'selectionGroupFrame') as Graphics;
  return { viewport, manager, highlights, group };
}

/** The accent's middle stands this far outside the token's ring, in screen pixels. */
const ACCENT_OFFSET = SELECTION_LOOK.gap + SELECTION_LOOK.stroke / 2;

describe('SelectionManager highlights', () => {
  it('outlines a single token by its ring, without a group frame', () => {
    const { highlights, group } = setup(['goblin']);
    expect(highlights()).toHaveLength(1);
    expect(highlights()[0]!.position).toMatchObject({ x: 100, y: 100 });
    expect(group.context.instructions).toHaveLength(0);
  });

  it('keeps the line and its gap the same on screen at any zoom', () => {
    const { viewport, highlights } = setup(['goblin']);
    const accentRadius = (): number => {
      const view = highlights()[0]!;
      const bounds = view.children[0]!.getLocalBounds();
      // The outermost band's edge lies HIGHLIGHT_EDGE plus the shade beyond the accent's middle
      return bounds.width / 2 - HIGHLIGHT_EDGE - 5;
    };
    expect(accentRadius()).toBeCloseTo(39 + ACCENT_OFFSET, 0);
    viewport.scale.set(3);
    viewport.emit('zoomed', {});
    expect(highlights()[0]!.scale.x).toBeCloseTo(1 / 3);
    expect(accentRadius()).toBeCloseTo(39 * 3 + ACCENT_OFFSET, 0);
  });

  it('frames two or more together around their highlights and bars', () => {
    const { highlights, group } = setup(['goblin', 'orc']);
    expect(highlights()).toHaveLength(2);
    const { minX, maxX, minY, maxY } = group.bounds;
    const pad = SELECTION_LOOK.groupGap + SELECTION_LOOK.groupStroke;
    // The bars are wider than the ring's highlight and reach 24 below the token's edge
    expect(minX).toBeCloseTo(100 - 50 - pad, 0);
    expect(maxX).toBeCloseTo(300 + 50 + pad, 0);
    expect(minY).toBeCloseTo(100 - 39 - ACCENT_OFFSET - HIGHLIGHT_EDGE - pad, 0);
    expect(maxY).toBeCloseTo(100 + 35 + 24 + pad, 0);
  });
});

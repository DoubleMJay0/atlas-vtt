import type { Application } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { requestRender } from '../RenderScheduler';
import { LiquidLayer, type LiquidLayerDeps } from './LiquidLayer';
import type { WorldBox } from './LiquidMesh';

/** The view rect, in world units. */
interface WorldRect { left: number; top: number; right: number; bottom: number }

/**
 * Whether anything of `box` lies in `view` grown by `margin` of its size on every side: the
 * player window frames at least the GM's view and often a little more around it.
 */
export function boxInView(view: WorldRect, box: WorldBox, margin = 0.5): boolean {
  const growX = (view.right - view.left) * margin;
  const growY = (view.bottom - view.top) * margin;
  return box.maxX >= view.left - growX && box.minX <= view.right + growX && box.maxY >= view.top - growY && box.minY <= view.bottom + growY;
}

/** The liquid surfaces of a view's scene, moving on its stage. */
export function createViewLiquids(app: Application, viewport: Viewport, store: LiquidLayerDeps['store']): LiquidLayer {
  return new LiquidLayer({
    store,
    ticker: app.ticker,
    requestRender: () => requestRender(app),
    inView: (box) => boxInView(viewport.getVisibleBounds(), box),
    drawable: app.renderer.name === 'webgl',
  });
}

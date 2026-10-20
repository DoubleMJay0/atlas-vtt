import type { GridSystem } from '../../grid/GridSystem';
import { createHexLayout, hexVertices, isHexGridType } from '../../grid/hexGeometry';
import type { PlacementGrid } from './placementLayout';

/**
 * The grid held tokens snap to and light the cells of: the grid as shown, where it is visible and
 * tokens snap to it (`snapToGrid`); null, so they are placed freely, otherwise.
 */
export function placementGridOf(grid: GridSystem | null, snapToGrid: boolean): PlacementGrid | null {
  if (!grid || !snapToGrid) return null;
  const { type, size, offsetX = 0, offsetY = 0, enabled } = grid.getOptions();
  if (enabled === false || !(size > 0)) return null;
  const layout = isHexGridType(type) ? createHexLayout(type, size, offsetX, offsetY) : null;
  const half = size / 2;
  return {
    hex: layout !== null,
    cellSize: size,
    snapToken: (point, tokenSize) => grid.snapTokenCenter(point.x, point.y, tokenSize),
    cellCentre: (point) => grid.snapToCellCenter(point.x, point.y),
    cellOutline: (centre) => layout
      ? hexVertices(layout, centre)
      : [
          { x: centre.x - half, y: centre.y - half },
          { x: centre.x + half, y: centre.y - half },
          { x: centre.x + half, y: centre.y + half },
          { x: centre.x - half, y: centre.y + half },
        ],
  };
}

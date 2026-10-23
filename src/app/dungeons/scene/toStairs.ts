import type { LevelLink } from '../../types/sceneLevelTypes';
import type { DungeonModel } from '../model';
import type { DungeonPlacement } from './toWalls';

/**
 * A dungeon's stairwells as the stairs of its scene: one level link per stairwell, on exactly its
 * drawn cells (the same rectangle on both floors), joining the floor above and the floor below
 * both ways, so a token put down on the treads of either goes to the other. `levelIds` are the
 * scene's levels by floor (index 0 the entry floor). Pure.
 */
export function stairLinks(model: DungeonModel, levelIds: readonly string[], placement: DungeonPlacement): Record<string, LevelLink> {
  const { originCell, pxPerCell } = placement;
  const world = (x: number, y: number): { x: number; y: number } => ({ x: (x - originCell.x) * pxPerCell, y: (y - originCell.y) * pxPerCell });
  const links: Record<string, LevelLink> = {};
  model.floors.forEach((floor, index) => {
    // Each stairwell once, from its upper end
    for (const stair of floor.stairs.filter(s => s.to > index)) {
      const upper = levelIds[index];
      const lower = levelIds[stair.to];
      if (!upper || !lower) continue;
      const id = `levellink_dungeon_${stair.link}`;
      const { x, y, w, h } = stair;
      links[id] = { id, kind: 'level-link', polygon: [world(x, y), world(x + w, y), world(x + w, y + h), world(x, y + h)], levels: [upper, lower] };
    }
  });
  return links;
}

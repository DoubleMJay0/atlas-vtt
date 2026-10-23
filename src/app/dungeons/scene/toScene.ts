import { normaliseGridOffset } from '../../grid/gridPlacement';
import { wallsCrowd } from '../../import/uvtt/uvttCrowding';
import type { MapSceneParts } from '../../import/writeMapScene';
import type { DoorKind, DungeonModel } from '../model';
import type { DungeonStyle, DungeonView } from '../style';
import { dungeonWalls, type DungeonPlacement } from './toWalls';

/** A dungeon's scene, and what became of its doors, for the log. */
export interface DungeonSceneParts {
  scene: MapSceneParts;
  doors: Partial<Record<DoorKind, number>>;
  /** Door cells that had no walls on both sides to close; left open. */
  unplaced: number;
}

/** The map is lit by its own drawing until the GM lowers the light. */
const DAYLIGHT = 1;

/**
 * What a dungeon brings to its scene on an image of `image` pixels drawn at `placement`: the grid
 * drawn on the map (half cells with small tiles; the image's pixel 0 lies on a line of both), the
 * entry floor's walls and doors,
 * no lights, and dynamic lighting in daylight, so nothing changes until the GM dims it. Null when
 * the walls would crowd too much to be joined (`wallsCrowd`); a generated dungeon never does.
 */
export function dungeonScene(
  model: DungeonModel,
  style: DungeonStyle,
  view: Pick<DungeonView, 'secrets' | 'smallTiles'>,
  placement: DungeonPlacement,
  image: { width: number; height: number },
): DungeonSceneParts | null {
  const { walls, doors, unplaced } = dungeonWalls(model, style, view, placement);
  if (wallsCrowd(Object.values(walls), image)) return null;
  const size = view.smallTiles ? placement.pxPerCell / 2 : placement.pxPerCell;
  return {
    scene: {
      grid: { size, ...normaliseGridOffset('square', size, 0, 0) },
      walls,
      lights: {},
      lighting: { enabled: true, ambient: DAYLIGHT },
    },
    doors,
    unplaced,
  };
}

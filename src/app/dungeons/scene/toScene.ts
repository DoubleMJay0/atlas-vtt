import { normaliseGridOffset } from '../../grid/gridPlacement';
import { wallsCrowd } from '../../import/uvtt/uvttCrowding';
import type { MapSceneParts } from '../../import/writeMapScene';
import { sealTolerance, worldTexel } from '../../lighting/lightingConstants';
import type { WallSegment } from '../../types/wallTypes';
import type { DoorKind, DungeonModel } from '../model';
import { visibleDungeon } from '../render/visibleDungeon';
import type { DungeonStyle, DungeonView } from '../style';
import { floorLetter } from './roomKeys';
import { objectShadows, tallObjects } from './objectShadows';
import { noteRooms, type NoteRoom } from './toNote';
import { stairLinks } from './toStairs';
import { newLevelId } from '../../levels/levelEdits';
import { dungeonWalls, type DungeonPlacement, type DungeonWalls } from './toWalls';

/** A dungeon's scene, and what became of its doors, for the log. */
export interface DungeonSceneParts {
  /** Grid, walls (object outlines included), stairs and lighting; the levels and pins are added once the maps and the note are written. */
  scene: MapSceneParts;
  /** The rooms of its note, each with its pin's place. */
  rooms: NoteRoom[];
  /** The scene's levels by floor (the entry floor first); null for a dungeon of one floor, whose scene has none. */
  levelIds: string[] | null;
  doors: Partial<Record<DoorKind, number>>;
  /** Door cells that had no walls on both sides to close; left open. */
  unplaced: number;
}

/** The map is lit by its own drawing until the GM lowers the light. */
const DAYLIGHT = 1;

/** The walls of one floor: its own and the outlines of its tall objects (`objectShadows`), on its level where the scene has several. */
function floorWalls(model: DungeonModel, style: DungeonStyle, view: DungeonView, placement: DungeonPlacement, image: { width: number; height: number }, index: number, levelIds: readonly string[] | null): DungeonWalls {
  const level = levelIds?.[index];
  const levels = level ? [level] : undefined;
  const id = levelIds ? `dungeon_${floorLetter(index).toLowerCase()}` : 'dungeon';
  const own = dungeonWalls(model, style, view, placement, index, { id, ...(levels && { levels }) });
  const tolerance = sealTolerance(worldTexel(image));
  const shadows = objectShadows(tallObjects(visibleDungeon(model, view, index), view), Object.values(own.walls), placement, tolerance, `wall_${id}_shadow`, levels);
  return { ...own, walls: { ...own.walls, ...shadows } };
}

/**
 * What a dungeon brings to its scene on images of `image` pixels drawn at `placement`: the grid
 * drawn on the map (half cells with small tiles; the image's pixel 0 lies on a line of both),
 * every floor's walls and doors and its tall objects' outlines, the stairs between floors, the
 * rooms of its note, no lights, and dynamic lighting in daylight, so nothing changes until the GM
 * dims it. A dungeon of several floors gets a level per floor; one of one floor none. Null when
 * the walls of a floor would crowd too much to be joined (`wallsCrowd`); a generated dungeon never does.
 */
export function dungeonScene(
  model: DungeonModel,
  style: DungeonStyle,
  view: DungeonView,
  placement: DungeonPlacement,
  image: { width: number; height: number },
): DungeonSceneParts | null {
  const levelIds = model.floors.length > 1 ? model.floors.map(() => newLevelId()) : null;
  const walls: Record<string, WallSegment> = {};
  const doors: Partial<Record<DoorKind, number>> = {};
  let unplaced = 0;
  for (const index of model.floors.keys()) {
    const floor = floorWalls(model, style, view, placement, image, index, levelIds);
    if (wallsCrowd(Object.values(floor.walls), image)) return null;
    Object.assign(walls, floor.walls);
    for (const [kind, count] of Object.entries(floor.doors) as [DoorKind, number][]) doors[kind] = (doors[kind] ?? 0) + count;
    unplaced += floor.unplaced;
  }
  const size = view.smallTiles ? placement.pxPerCell / 2 : placement.pxPerCell;
  const links = levelIds && stairLinks(model, levelIds, placement);
  return {
    scene: {
      grid: { size, ...normaliseGridOffset('square', size, 0, 0) },
      walls,
      lights: {},
      lighting: { enabled: true, ambient: DAYLIGHT },
      ...(links && { levelLinks: links }),
    },
    rooms: noteRooms(model, view, placement, levelIds),
    levelIds,
    doors,
    unplaced,
  };
}

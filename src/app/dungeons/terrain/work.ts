/** What every terrain pass shares: the floors being placed, the tags, the theme, the links of holes, the streams. */

import { type Rng, floorStream } from '../rng';
import type { DungeonTag } from '../tags';
import type { ThemeContext } from '../themes/themes';
import type { FloorTerrain } from './floorTerrain';

export interface TerrainWork {
  floors: readonly FloorTerrain[];
  tags: ReadonlySet<DungeonTag>;
  theme: ThemeContext;
  /** A new id shared by the holes of one shaft or abyss and the floor under it. */
  nextLink: () => number;
  /** The terrain stream of a floor, split by `key`. */
  rng: (floor: number, key: string) => Rng;
}

export function terrainWork(seed: number, floors: readonly FloorTerrain[], tags: ReadonlySet<DungeonTag>, theme: ThemeContext): TerrainWork {
  let link = 0;
  return { floors, tags, theme, nextLink: () => link++, rng: (floor, key) => floorStream(seed, 'terrain', floor, key) };
}

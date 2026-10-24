/**
 * What grows in a dungeon, from its tags: which climbers, floor plants and undergrowth, and how
 * much. An overgrown dungeon grows richly (ivy, moss and ferns); a wet one only moss and ferns by
 * its water; a crumbling one weeds in its cracks. A dry dungeon or one of lava or acid grows
 * nothing unless it is overgrown.
 */

import type { GrowthKind } from '../growthModel';
import type { TerrainKind } from '../terrainModel';
import type { DungeonTag } from '../tags';

export type Weights<T> = readonly (readonly [T, number])[];

export type UndergrowthKind = Extract<TerrainKind, 'brambles' | 'thicket' | 'tangled-roots'>;

export interface Flora {
  /** Overgrown: growth on every kind of wall and floor, not only by water and in cracks. */
  rich: boolean;
  /** Moss and ferns by the water. */
  damp: boolean;
  /** Weeds in the cracks. */
  cracks: boolean;
  climbers: Weights<GrowthKind>;
  patches: Weights<GrowthKind>;
  undergrowth: Weights<UndergrowthKind>;
  /** What climbs columns. */
  columns: Weights<GrowthKind>;
  /** What grows at the water's edge. */
  shore: Weights<GrowthKind>;
}

interface Theme {
  climbers: Weights<GrowthKind>;
  patches: Weights<GrowthKind>;
  undergrowth: Weights<UndergrowthKind>;
}

const DEFAULT_THEME: Theme = {
  climbers: [['ivy', 5], ['moss', 2], ['grass', 1]],
  patches: [['moss', 3], ['fern', 3], ['grass', 2], ['fungi', 0.5]],
  undergrowth: [['thicket', 2], ['brambles', 1]],
};

/** Moss and ferns want water: in a dry dungeon they grow a third as often. */
function drier(weights: Weights<GrowthKind>): Weights<GrowthKind> {
  return weights.map(([kind, w]) => [kind, kind === 'moss' || kind === 'fern' ? w / 3 : w] as const);
}

/** What grows in a dungeon of these tags, or null where nothing does. */
export function floraOf(tags: ReadonlySet<DungeonTag>): Flora | null {
  const rich = tags.has('overgrown');
  const dry = tags.has('dry');
  const damp = !dry && (tags.has('wet') || tags.has('flooded') || rich);
  const cracks = tags.has('crumbling') || rich;
  if (!rich && (dry || tags.has('lava') || tags.has('acid'))) return null;
  if (!rich && !damp && !cracks) return null;
  const theme = DEFAULT_THEME;
  const { climbers, patches } = theme;
  return {
    rich,
    damp,
    cracks,
    climbers: dry ? drier(climbers) : climbers,
    patches: dry ? drier(patches) : patches,
    undergrowth: theme.undergrowth,
    columns: [['ivy', 3], ['creeper', 0.3]],
    shore: [['moss', 3], ['fern', 3]],
  };
}

/**
 * What grows in a dungeon, from its tags: which climbers, floor plants and undergrowth, and how
 * much. An overgrown dungeon grows richly, each theme its own kinds (a temple flowering vines, a
 * tomb roots, pale fungi and dead creepers, a dwelling weeds and brambles, anything else ivy, moss
 * and ferns); a wet one only moss and ferns by its water; a crumbling one weeds in its cracks. A dry
 * dungeon or one of lava or acid grows nothing unless it is overgrown.
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
  /** What climbs a temple's columns. */
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

const THEMES: Partial<Record<DungeonTag, Theme>> = {
  temple: {
    climbers: [['vine', 4], ['ivy', 3], ['moss', 1.5]],
    patches: [['moss', 3], ['fern', 2], ['grass', 2]],
    undergrowth: [['thicket', 2], ['brambles', 1]],
  },
  tomb: {
    climbers: [['creeper', 4], ['roots', 3], ['moss', 2], ['ivy', 1]],
    patches: [['fungi', 4], ['moss', 3], ['fern', 0.5]],
    undergrowth: [['tangled-roots', 4], ['brambles', 0.5]],
  },
  dwelling: {
    climbers: [['ivy', 4], ['grass', 3], ['moss', 1]],
    patches: [['grass', 5], ['moss', 2], ['fern', 1]],
    undergrowth: [['brambles', 4], ['thicket', 1]],
  },
};

/** Weights of several themes added up, kind by kind. */
function merged<T>(lists: readonly Weights<T>[]): Weights<T> {
  const sum = new Map<T, number>();
  for (const list of lists) for (const [kind, w] of list) sum.set(kind, (sum.get(kind) ?? 0) + w);
  return [...sum];
}

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
  const themes = (['temple', 'tomb', 'dwelling'] as const).flatMap((tag) => (tags.has(tag) ? [THEMES[tag]!] : []));
  const theme = themes.length ? themes : [DEFAULT_THEME];
  const climbers = merged(theme.map((t) => t.climbers));
  const patches = merged(theme.map((t) => t.patches));
  const tomb = tags.has('tomb');
  return {
    rich,
    damp,
    cracks,
    climbers: dry ? drier(climbers) : climbers,
    patches: dry ? drier(patches) : patches,
    undergrowth: merged(theme.map((t) => t.undergrowth)),
    columns: tags.has('temple') ? [['vine', 3], ['ivy', 2]] : [['ivy', 3], ['creeper', tomb ? 2 : 0.3]],
    shore: tomb ? [['moss', 3], ['fungi', 2], ['fern', 1]] : [['moss', 3], ['fern', 3]],
  };
}

/**
 * What a dungeon is: its kind (which decides how its story begins and which boss titles fit) and
 * the noun every mention uses ("the crypt", "the catacombs").
 */

import type { DungeonTag } from '../../tags';

export type PlaceKind = 'temple' | 'tomb' | 'fort' | 'house' | 'lair' | 'mine' | 'water' | 'lore' | 'prison' | 'cave' | 'works';

export const PLACE_KINDS: readonly PlaceKind[] = ['temple', 'tomb', 'fort', 'house', 'lair', 'mine', 'water', 'lore', 'prison', 'cave', 'works'];

export const PLACES: Readonly<Record<PlaceKind, readonly string[]>> = {
  temple: ['temple', 'shrine', 'sanctum', 'chapel', 'cathedral', 'abbey', 'monastery', 'cloister', 'sanctuary', 'basilica', 'oratory', 'priory'],
  tomb: ['tomb', 'crypt', 'catacombs', 'barrow', 'mausoleum', 'sepulchre', 'ossuary', 'necropolis', 'undercroft', 'charnel vaults'],
  fort: ['keep', 'fortress', 'citadel', 'bastion', 'stronghold', 'hold', 'garrison', 'redoubt', 'tower'],
  house: ['manor', 'house', 'palace', 'court', 'villa', 'halls', 'lodge', 'castle'],
  lair: ['lair', 'den', 'nest', 'warren', 'hive', 'vault', 'hoard'],
  mine: ['mines', 'delve', 'pit', 'quarry', 'deeps', 'diggings', 'shafts'],
  water: ['cistern', 'baths', 'aqueduct', 'reservoir', 'sluices', 'wellhouse'],
  lore: ['library', 'archive', 'observatory', 'scriptorium', 'athenaeum', 'academy'],
  prison: ['prison', 'gaol', 'oubliette', 'dungeons', 'pens', 'cells'],
  cave: ['caves', 'grotto', 'cavern', 'hollows', 'labyrinth', 'maze', 'sinkhole'],
  works: ['forge', 'foundry', 'kilns', 'smelter', 'mint', 'workshops'],
};

/** How much each tag pulls towards each kind of place; every kind starts at 1. */
const PULL: Partial<Record<DungeonTag, Partial<Record<PlaceKind, number>>>> = {
  temple: { temple: 8 },
  tomb: { tomb: 8 },
  dwelling: { house: 6, lore: 1 },
  wet: { water: 4, cave: 2 },
  flooded: { water: 5, cave: 2 },
  dry: { works: 3, mine: 1 },
  treasure: { lair: 4, house: 1 },
  dangerous: { lair: 2, prison: 2 },
  crumbling: { mine: 1, fort: 1 },
  deep: { mine: 4 },
  ordered: { fort: 2, temple: 1 },
  chaotic: { cave: 2, lair: 2 },
  winding: { cave: 3, mine: 1 },
  round: { temple: 1 },
  colonnades: { temple: 2, water: 2 },
  cramped: { prison: 3 },
  spacious: { house: 1, temple: 1 },
  large: { fort: 1 },
  'multi-level': { mine: 1 },
  string: { water: 1 },
};

export function placeKindWeights(tags: readonly DungeonTag[]): [PlaceKind, number][] {
  return PLACE_KINDS.map((kind) => [kind, 1 + tags.reduce((sum, tag) => sum + (PULL[tag]?.[kind] ?? 0), 0)]);
}

/** The place a title names ("Lower Crypt of Ysmar" → crypt), so a GM's own name decides it. */
export function placeInTitle(title: string): { noun: string; kind: PlaceKind } | null {
  const lower = ` ${title.toLowerCase().replace(/[^a-z' -]/g, ' ')} `;
  for (const kind of PLACE_KINDS) {
    for (const noun of PLACES[kind]) {
      if (lower.includes(` ${noun} `)) return { noun, kind };
      if (lower.includes(` ${noun}s `)) return { noun: `${noun}s`, kind };
    }
  }
  return null;
}

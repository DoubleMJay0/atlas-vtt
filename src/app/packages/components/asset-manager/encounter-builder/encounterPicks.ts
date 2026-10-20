import type { EncounterTokenDraft } from '../../../../encounters/encounterSaveService';
import type { TokenAsset } from '../types';

/** One creature of the encounter being built: a library token and how many of it. */
export interface EncounterPick {
  token: TokenAsset;
  count: number;
}

/** The most copies of one creature an encounter takes; a typo of 1000 goblins stops here. */
export const MAX_PICK_COUNT = 99;

/** The picks with `token` set to `count` copies, in the order they were first picked; 0 removes it. */
export function withCount(picks: readonly EncounterPick[], token: TokenAsset, count: number): EncounterPick[] {
  const clamped = Math.max(0, Math.min(MAX_PICK_COUNT, Math.round(count)));
  const index = picks.findIndex((pick) => pick.token.id === token.id);
  if (index === -1) return clamped > 0 ? [...picks, { token, count: clamped }] : [...picks];
  if (clamped === 0) return picks.filter((_, at) => at !== index);
  return picks.map((pick, at) => (at === index ? { token: pick.token, count: clamped } : pick));
}

export function countOf(picks: readonly EncounterPick[], tokenId: string): number {
  return picks.find((pick) => pick.token.id === tokenId)?.count ?? 0;
}

export function totalCount(picks: readonly EncounterPick[]): number {
  return picks.reduce((sum, pick) => sum + pick.count, 0);
}

/**
 * The encounter's token references: one per copy, as an encounter saved from the map holds one per
 * token. Without a formation they are placed in the grid layout encounters fall back to.
 */
export function encounterDrafts(picks: readonly EncounterPick[]): EncounterTokenDraft[] {
  return picks.flatMap(({ token, count }) => Array.from({ length: count }, (): EncounterTokenDraft => ({
    id: token.id,
    name: token.name,
    imagePath: token.imagePath ?? '',
    size: token.size ?? 1,
    ...(token.statblockPath !== undefined && { statblockPath: token.statblockPath }),
  })));
}

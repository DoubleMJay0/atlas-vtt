import type { TokenAsset, AnyAsset, EncounterAsset } from '../types';
import { placeFormation, type FormationSlot } from '../../../../encounters/encounterFormation';
import type { TokenInput } from '../../../../types/viewState';
import { tokenFromFile } from '../../../../resources/resourceFileFormat';
import { addOffMapCombatants, joinInitiative } from '../../../../initiative/offMapCombatants';
import { t } from '../../../../i18n';
import { showNotice } from '../../../../ui/notice';
import { getSpawnTarget, getViewportCenter, gridPosition, type SpawnContext, type SpawnTarget } from './spawnTarget';
import { buildTokenData, imageExists, joiningSavedToken, resolveTokenSource, spawnRules } from './tokenSpawnData';

export type { SpawnContext } from './spawnTarget';

/**
 * Where spawned tokens go: onto the map (`map`), onto it and into the initiative tracker (`fight`),
 * or into the tracker beside the map (`beside`, `tokens/offMap.ts`), where they wait in a column
 * left of the map image.
 */
export type SpawnPlacement = 'map' | 'fight' | 'beside';

/** Formation slots for an encounter, or null if any token lacks captured layout data. */
function encounterSlots(encounter: EncounterAsset): FormationSlot[] | null {
  if (!encounter.formation) return null;
  const slots: FormationSlot[] = [];
  for (const token of encounter.tokens ?? []) {
    if (!token.cell || !token.offset) return null;
    slots.push({ cell: token.cell, offset: token.offset });
  }
  return slots;
}

/**
 * Adds the tokens to the target's scene in one store write (a single undo step): on the map, where
 * they are selected and, for a fight, put in the tracker; or beside it, into the tracker.
 */
function addSpawnedTokens(target: SpawnTarget, tokens: TokenInput[], placement: SpawnPlacement): string[] {
  const store = target.view.getStore();
  if (placement === 'beside') return addOffMapCombatants(store, tokens);
  const { addTokens, setSelection } = store.getState();
  const ids = addTokens(tokens);
  if (ids.length > 0) setSelection(ids);
  if (placement === 'fight') joinInitiative(store, ids);
  return ids;
}

// ─── Public spawn functions ─────────────────────────────────────────

/** Copies of one token asset to spawn together. */
export interface TokenGroup {
  asset: TokenAsset;
  count: number;
}

/**
 * Spawn copies of token assets in one store write (one undo step): on the map around its view's
 * centre, or beside it into the tracker (`placement`). Each asset's statblock is read once; each
 * copy rolls its own hit points where the rules say so.
 */
export async function spawnTokenGroups(ctx: SpawnContext, groups: readonly TokenGroup[], placement: SpawnPlacement = 'map'): Promise<string[]> {
  const target = await getSpawnTarget(ctx);
  if (!target) return [];
  const { viewport, grid, pitch } = target;
  const gridSystem = grid ? target.gridSystem : null;
  const center = getViewportCenter(viewport);
  const rules = spawnRules(ctx, target);
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  const tokens: TokenInput[] = [];
  for (const { asset, count } of groups) {
    const source = await resolveTokenSource(ctx, asset);
    if (!source) continue;
    const built = await buildTokenData(ctx.app, center, source, rules);
    for (let copy = 0; copy < count; copy++) {
      tokens.push({ ...built.joined(), ...gridPosition(tokens.length, total, center.x, center.y, pitch, gridSystem, built.data.size || 1) });
    }
  }
  return addSpawnedTokens(target, tokens, placement);
}

/** Spawn `count` copies of a single token asset (`spawnTokenGroups`). */
export function spawnTokenAsset(ctx: SpawnContext, asset: TokenAsset, count: number, placement: SpawnPlacement = 'map'): Promise<string[]> {
  return spawnTokenGroups(ctx, [{ asset, count }], placement);
}

/**
 * Spawn all tokens from an encounter asset (`placement`: on the map in its formation, on it and
 * into the tracker for a fight, or beside it into the tracker) and report how many it added.
 */
export async function spawnEncounterTokens(
  ctx: SpawnContext,
  encounter: EncounterAsset,
  placement: SpawnPlacement = 'map',
): Promise<string[]> {
  const target = await getSpawnTarget(ctx);
  if (!target) return [];
  const { viewport, grid, pitch } = target;
  const gridSystem = grid ? target.gridSystem : null;
  const center = getViewportCenter(viewport);
  const tokensToSpawn = encounter.tokens || [];

  const slots = encounterSlots(encounter);
  const formationPositions = slots && encounter.formation
    ? placeFormation(slots, encounter.formation, center, grid, tokensToSpawn.map((token) => token.size))
    : null;

  const rules = spawnRules(ctx, target);
  const tokens: TokenInput[] = [];
  for (let i = 0; i < tokensToSpawn.length; i++) {
    const token = tokensToSpawn[i];
    if (!token) continue;

    // Captured formation → legacy absolute offsets → generic grid layout
    let pos: { x: number; y: number };
    const formationPos = formationPositions?.[i];
    if (formationPos) {
      pos = formationPos;
    } else if (token.x !== undefined && token.y !== undefined) {
      let x = center.x + token.x;
      let y = center.y + token.y;
      if (gridSystem) {
        const snapped = gridSystem.snapTokenCenter(x, y, token.size || 1);
        x = snapped.x;
        y = snapped.y;
      }
      pos = { x, y };
    } else {
      pos = gridPosition(i, tokensToSpawn.length, center.x, center.y, pitch, gridSystem, token.size || 1);
    }

    // A saved state snapshot is restored as saved (in today's token format). Encounters built from token
    // assets rebuild from the asset, so they follow its current image, size and ring.
    if (token.state) {
      if (imageExists(ctx.app, token.imagePath)) {
        tokens.push(await joiningSavedToken(ctx, { ...tokenFromFile(token.state), imagePath: token.imagePath, x: pos.x, y: pos.y }, rules));
      }
      continue;
    }
    const source = await resolveTokenSource(ctx, token);
    if (source && imageExists(ctx.app, source.imagePath)) {
      tokens.push((await buildTokenData(ctx.app, pos, source, rules)).joined());
    }
  }

  const ids = addSpawnedTokens(target, tokens, placement);
  showNotice(ids.length < tokensToSpawn.length
    ? t(placement === 'beside' ? 'am.besidePartial' : 'am.spawnedPartial', { count: ids.length, expected: tokensToSpawn.length, name: encounter.name })
    : t(placement === 'beside' ? 'am.beside' : 'am.spawned', { count: ids.length, name: encounter.name }));
  return ids;
}

/**
 * Spawn multiple selected token assets (from context menu "Spawn N tokens on map", or beside the map into the tracker).
 */
export async function spawnSelectedTokens(
  ctx: SpawnContext,
  selectedAssets: AnyAsset[],
  placement: SpawnPlacement = 'map',
): Promise<string[]> {
  const target = await getSpawnTarget(ctx);
  if (!target) return [];
  const { viewport, grid, pitch } = target;
  const gridSystem = grid ? target.gridSystem : null;
  const center = getViewportCenter(viewport);
  const tokensToSpawn = selectedAssets.filter(a => a.type === 'tokens');

  const rules = spawnRules(ctx, target);
  const tokens: TokenInput[] = [];
  for (let i = 0; i < tokensToSpawn.length; i++) {
    const tokenAsset = tokensToSpawn[i];
    if (!tokenAsset) continue;

    const source = await resolveTokenSource(ctx, tokenAsset);
    if (!source) continue;
    const pos = gridPosition(i, tokensToSpawn.length, center.x, center.y, pitch, gridSystem, source.size || 1);
    tokens.push((await buildTokenData(ctx.app, pos, source, rules)).joined());
  }

  return addSpawnedTokens(target, tokens, placement);
}

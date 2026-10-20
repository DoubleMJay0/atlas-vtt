import type { AtlasView } from '../atlas-view';
import { spawnTargetOf, viewCentrePlace } from '../packages/components/asset-manager/utils/spawnTarget';
import { isOffMap, sceneTokens } from '../tokens/offMap';

/**
 * Puts a combatant kept beside the map on it, in the middle of what the GM sees (on the grid where
 * tokens snap), on top of every other token and selected: one undo step, after which it is a token
 * like any other. Nothing while the scene is loading or the token is no longer beside the map.
 */
export function placeCombatantOnMap(view: AtlasView, tokenId: string): void {
  const store = view.getStore();
  const token = sceneTokens(store.getState().objects)[tokenId];
  if (!isOffMap(token)) return;
  const target = spawnTargetOf(view);
  if (!target) return;
  const { x, y } = viewCentrePlace(target, token?.size || 1);
  store.getState().placeOffMapToken(tokenId, x, y);
}

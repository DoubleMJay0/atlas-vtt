import type { AtlasView } from '../atlas-view';
import type { ViewAtlasState } from '../storeFactory';
import { panToToken } from '../pixi/tokenFocus';
import { addTokenHighlight } from '../pixi/utils/tokenHighlight';

/**
 * The selection after a click on a combatant's card, as a click on its token makes it: the token
 * alone, or with Shift added to the selection, and taken out of it where it was in.
 */
export function cardClickSelection(selectedIds: readonly string[], tokenId: string, additive: boolean): string[] {
  if (!additive) return [tokenId];
  return selectedIds.includes(tokenId) ? selectedIds.filter((id) => id !== tokenId) : [...selectedIds, tokenId];
}

/**
 * A click on a combatant's card: selects its token as a click on the map would, so its bars and
 * their controls show, brings it into view at the GM's zoom (`panToToken`) and lets it glow.
 */
export function focusCombatant(
  view: AtlasView | null,
  state: Pick<ViewAtlasState, 'objects' | 'selectedIds' | 'setSelection' | 'grid'>,
  tokenId: string,
  additive: boolean,
): void {
  const token = state.objects.tokens[tokenId];
  if (!token) return;
  state.setSelection(cardClickSelection(state.selectedIds, tokenId, additive));
  const viewport = view?.renderer?.getViewportInstance?.();
  if (!viewport) return;
  panToToken(viewport, token, state.grid?.size ?? 70);
  addTokenHighlight(view, tokenId);
}

import type { ContextMenuEntry } from '../root/ContextMenuContext';
import { SIDE_LABELS, otherSide, sideOf } from '../../initiative/sides';
import type { TokenUpdates } from '../../types/viewState';
import type { TokenEntity } from '../../types';
import type { InitiativeEntry } from '../../types/initiativeTypes';
import type { InitiativeSide } from '../../types/initiativeRulesTypes';
import { playerVision } from '../../characters/playerVision';
import { t } from '../../i18n';

interface CardMenuActions {
  roll: () => void;
  moveToFront: () => void;
  moveToBack: () => void;
  edit: () => void;
  updateToken: (changes: TokenUpdates) => void;
  setSitsOut: (sitsOut: boolean) => void;
  delay: () => void;
  actNow: () => void;
  remove: () => void;
}

/** Moves a token to `side`; one moved to the players' side sees by default (`playerVision`), and nothing switches vision off. */
function sideChanges(token: TokenEntity | undefined, side: InitiativeSide): TokenUpdates {
  const vision = side === 'players' ? playerVision(token?.vision) : undefined;
  return vision ? { side, vision } : { side };
}

/**
 * The menu of a combatant's card. In turn order it rolls and edits the combatant's number; by
 * sides there is none, and the card moves to the other side. While a fight runs a combatant
 * sits a round out, and in turn order delays its turn and acts again when the GM says.
 */
export function initiativeCardMenu(
  entry: InitiativeEntry,
  token: TokenEntity | undefined,
  mode: { bySides: boolean; fightRuns: boolean },
  actions: CardMenuActions,
): ContextMenuEntry[] {
  const hidden = token?.isHidden ?? false;
  const other = otherSide(sideOf(token));
  const item = (label: string, icon: string, onClick: () => void): ContextMenuEntry => ({ type: 'item', label, icon, onClick });
  const sitOut = entry.sitsOut
    ? item(t('initiative.actThisRound'), 'play', () => actions.setSitsOut(false))
    : item(t('initiative.sitOut'), 'pause', () => actions.setSitsOut(true));
  const delay = entry.delayed
    ? item(t('initiative.actNow'), 'step-forward', actions.actNow)
    : item(t('initiative.delay'), 'hourglass', actions.delay);

  return [
    ...(mode.bySides ? [] : [item(t('initiative.roll'), 'dice', actions.roll)]),
    item(t('initiative.toFront'), 'arrow-up-to-line', actions.moveToFront),
    item(t('initiative.toBack'), 'arrow-down-to-line', actions.moveToBack),
    ...(mode.bySides
      ? [item(`Move to ${SIDE_LABELS[other]}`, 'arrow-left-right', () => actions.updateToken(sideChanges(token, other)))]
      : [item(t('initiative.edit'), 'pencil', actions.edit)]),
    ...(mode.fightRuns ? [sitOut, ...(mode.bySides ? [] : [delay])] : []),
    item(hidden ? 'Show to Players' : 'Hide from Players', hidden ? 'eye' : 'eye-off', () => actions.updateToken({ isHidden: !hidden })),
    { type: 'item', label: t('initiative.remove'), icon: 'trash-2', destructive: true, onClick: actions.remove },
  ];
}

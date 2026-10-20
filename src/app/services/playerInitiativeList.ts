import type { ResourceDefinition, ResourceValue } from '../resources/resourceTypes';
import type { TokenEntity } from '../types';
import type { ConditionDefinition } from '../types/collectionSettingsTypes';
import type { InitiativeEntry, InitiativeState } from '../types/initiativeTypes';
import type { InitiativeRules, InitiativeSide } from '../types/initiativeRulesTypes';
import { SIDE_LABELS, listedBySides, sideOf, sidesInOrder } from '../initiative/sides';
import { combatantDefeated } from '../initiative/defeated';
import { listSegments, type ListSegment } from '../initiative/listSegments';
import type { InitiativeDock } from '../initiative/initiativeLayout';
import { combatantConditions, type ActiveCondition } from '../utils/activeConditions';
import { scrollWithin } from '../utils/scrollWithin';
import { renderPlayerCard } from './playerInitiativeCard';
import './player-initiative.scss';
import { t } from '../i18n';

/** What the players' list reads from a combatant's token. */
export interface EntryToken {
  hp: ResourceValue | null;
  /** The map frames a token unless its ring is switched off. */
  showRing: boolean;
  ringColor?: string | undefined;
  side: InitiativeSide;
  /** Defeated, as the GM's card shows it with its skull: shown dimmed and marked, never left out. */
  defeated: boolean;
  /** The condition badges the map shows players on the token (`combatantConditions`). */
  conditions?: ActiveCondition[];
}

/** What the players' list shows of an initiative entry. */
export type PlayerInitiativeEntry = Pick<InitiativeEntry, 'tokenId' | 'name' | 'initiative' | 'awaitingInitiative' | 'isActive' | 'imagePath' | 'order' | 'sitsOut' | 'delayed'>;

/** A combatant the players see, with what the list shows of its token. */
export interface Combatant {
  entry: PlayerInitiativeEntry;
  token: EntryToken;
}

/** The players' initiative list as it is drawn: the combatants they see in turn order, and how the fight runs. */
export interface PlayerInitiativeList {
  combatants: Combatant[];
  /** A fight is running: the turn and the round are shown. */
  isActive: boolean;
  round: number;
  /** The combatants are grouped by side (`listedBySides`). */
  bySides: boolean;
  /** The side that acts first in a round. */
  firstSide: InitiativeSide;
  /** The side whose turn it is in a fight by sides. */
  activeSide: InitiativeSide | null;
  /**
   * In a fight in turn order, the place in the order of the combatant whose turn it is, also one
   * the players do not see: a list that starts at the turn starts with the first they see from
   * there. Null without a fight or a turn.
   */
  turnOrder: number | null;
}

/** How the list draws names and portraits, and how the GM laid the lists out. */
export interface PlayerInitiativeLook {
  showNames: boolean;
  /** The address of an entry's portrait, or null to draw none. */
  portraitSrc(imagePath: string): string | null;
  /** The number a combatant's badge shows the players on the map, which tells look-alikes apart; null for none. */
  badgeNumber?(tokenId: string): number | null;
  /** The GM's choice: during a fight the list starts at the turn and runs on into the next round. */
  fromTurn?: boolean;
  /** The edge the GM docked the lists at; the right one unless said. */
  dock?: InitiativeDock;
}

/** Whether players see a combatant: its token is on the map and not hidden. */
export function listedForPlayers(token: Pick<TokenEntity, 'isHidden'> | undefined): boolean {
  return !!token && !token.isHidden;
}

/**
 * What the players' list reads of a combatant's token; `definitions` are the map's resources, which
 * say who is defeated, and `conditionDefinitions` its conditions, drawn as the map draws them.
 */
export function entryTokenOf(
  token: TokenEntity | undefined,
  definitions: readonly ResourceDefinition[],
  conditionDefinitions: readonly ConditionDefinition[] = [],
): EntryToken {
  return {
    hp: token?.resources?.hp ?? null,
    showRing: token?.showRing !== false,
    ringColor: token?.ringColor,
    side: sideOf(token),
    defeated: combatantDefeated(token, definitions),
    conditions: combatantConditions(token, conditionDefinitions),
  };
}

/**
 * The list players see of a fight: every entry `tokenOf` answers for (those whose token they may
 * see), in turn order, grouped by side as the fight runs or the collection's rules say. Hit points
 * show only where `hpVisible`.
 */
export function playerInitiativeList(
  initiative: Pick<InitiativeState, 'isActive' | 'round' | 'sides'> & { entries: readonly PlayerInitiativeEntry[] },
  tokenOf: (entry: PlayerInitiativeEntry, index: number) => EntryToken | null,
  rules: InitiativeRules,
  hpVisible: boolean,
): PlayerInitiativeList {
  const combatants = initiative.entries
    .flatMap((entry, index): Combatant[] => {
      const token = tokenOf(entry, index);
      return token ? [{ entry, token: hpVisible ? token : { ...token, hp: null } }] : [];
    })
    .sort((a, b) => a.entry.order - b.entry.order);
  const bySides = listedBySides(initiative, rules);
  const turn = initiative.isActive && !bySides ? initiative.entries.find((entry) => entry.isActive && !entry.delayed) : undefined;
  return {
    combatants,
    isActive: initiative.isActive,
    round: initiative.round,
    bySides,
    firstSide: initiative.sides?.first ?? rules.firstSide,
    activeSide: initiative.sides?.active ?? null,
    turnOrder: turn ? turn.order : null,
  };
}

/** The players' list as it is drawn (`listSegments`): a side nobody is shown of is left out. */
export function playerSegments(list: PlayerInitiativeList, fromTurn: boolean): ListSegment<Combatant>[] {
  const order = list.combatants.filter(({ entry }) => !entry.delayed);
  const { turnOrder } = list;
  return listSegments(list.combatants, {
    bySides: list.bySides,
    sides: sidesInOrder(list.firstSide),
    sideOf: ({ token }) => token.side,
    delayed: ({ entry }) => entry.delayed === true,
    fightRuns: list.isActive,
    round: list.round,
    activeSide: list.activeSide,
    turnAt: turnOrder === null ? -1 : order.findIndex(({ entry }) => entry.order >= turnOrder),
    fromTurn,
    emptySides: false,
  });
}

/** Draws the players' list into `container`; nothing while it has no combatants. */
export function renderPlayerInitiative(container: HTMLElement, list: PlayerInitiativeList, look: PlayerInitiativeLook): void {
  if (!list.combatants.length) return;
  const panel = container.createDiv({
    cls: 'atlas-player-initiative',
    attr: { role: 'region', 'aria-label': t('playerInit.order') },
  });
  if (look.dock === 'left') panel.addClass('atlas-player-initiative--left');
  const fromTurn = look.fromTurn === true;
  const entries = panel.createDiv({ cls: 'atlas-player-initiative__list' });
  // In turn order the list is the list of combatants; by sides each side is one
  if (!list.bySides) entries.setAttribute('role', 'list');
  for (const segment of playerSegments(list, fromTurn)) renderSegment(entries, segment, list, look);
  if (list.isActive) {
    panel.createDiv({ cls: 'atlas-player-initiative__round', text: t('playerInit.round', { round: list.round }) });
    // The list is drawn anew on every change: show the turn and the next two visible combatants,
    // or the top of a list that starts at the turn
    const side = panel.querySelector('.atlas-player-initiative__side--active');
    const card = panel.querySelector('.atlas-player-initiative__card--active');
    if (side) scrollWithin(entries, side, 'start');
    else if (card && fromTurn) scrollWithin(entries, card, 'start');
    else if (card) scrollWithin(entries, card, 'nearest', 2);
  }
}

function renderSegment(entries: HTMLElement, segment: ListSegment<Combatant>, list: PlayerInitiativeList, look: PlayerInitiativeLook): void {
  if (segment.kind === 'round') {
    const label = t('playerInit.round', { round: segment.round });
    entries.createDiv({ cls: 'atlas-player-initiative__next-round', attr: { role: 'separator', 'aria-label': label } })
      .createSpan({ cls: 'atlas-player-initiative__next-round-label', text: label, attr: { 'aria-hidden': 'true' } });
    return;
  }
  if (segment.side) {
    const label = SIDE_LABELS[segment.side];
    const group = entries.createDiv({ cls: 'atlas-player-initiative__side', attr: { role: 'list', 'aria-label': label } });
    if (segment.active) {
      group.addClass('atlas-player-initiative__side--active');
      group.setAttribute('aria-current', 'true');
    }
    group.createDiv({ cls: 'atlas-player-initiative__side-label', text: label, attr: { 'aria-hidden': 'true' } });
    // By sides the turn is the side's and there are no numbers
    for (const member of segment.items) renderPlayerCard(group, member, look, false, false);
    return;
  }
  if (segment.delayed) {
    const group = entries.createDiv({ cls: 'atlas-player-initiative__side', attr: { role: 'list', 'aria-label': t('playerInit.delayed') } });
    group.createDiv({ cls: 'atlas-player-initiative__side-label', text: t('playerInit.delayed'), attr: { 'aria-hidden': 'true' } });
    for (const combatant of segment.items) renderPlayerCard(group, combatant, look, false);
    return;
  }
  for (const combatant of segment.items) renderPlayerCard(entries, combatant, look, list.isActive);
}

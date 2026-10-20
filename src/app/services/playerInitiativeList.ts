import type { ResourceDefinition, ResourceValue } from '../resources/resourceTypes';
import type { TokenEntity } from '../types';
import type { InitiativeEntry, InitiativeState } from '../types/initiativeTypes';
import type { InitiativeRules, InitiativeSide } from '../types/initiativeRulesTypes';
import { createTokenPortrait } from '../packages/components/shared/tokenPortraitElement';
import { SIDE_LABELS, listedBySides, sideOf, sidesInOrder } from '../initiative/sides';
import { combatantDefeated } from '../initiative/defeated';
import { scrollWithin } from '../utils/scrollWithin';
import { hasInitiative } from '../initiative/awaitingInitiative';
import { setIcon } from 'obsidian';
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
}

/** How the list draws names and portraits. */
export interface PlayerInitiativeLook {
  showNames: boolean;
  /** The address of an entry's portrait, or null to draw none. */
  portraitSrc(imagePath: string): string | null;
  /** The number a combatant's badge shows the players on the map, which tells look-alikes apart; null for none. */
  badgeNumber?(tokenId: string): number | null;
}

/** Whether players see a combatant: its token is on the map and not hidden. */
export function listedForPlayers(token: Pick<TokenEntity, 'isHidden'> | undefined): boolean {
  return !!token && !token.isHidden;
}

/** What the players' list reads of a combatant's token; `definitions` are the map's resources, which say who is defeated. */
export function entryTokenOf(token: TokenEntity | undefined, definitions: readonly ResourceDefinition[]): EntryToken {
  return {
    hp: token?.resources?.hp ?? null,
    showRing: token?.showRing !== false,
    ringColor: token?.ringColor,
    side: sideOf(token),
    defeated: combatantDefeated(token, definitions),
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
  return {
    combatants,
    isActive: initiative.isActive,
    round: initiative.round,
    bySides: listedBySides(initiative, rules),
    firstSide: initiative.sides?.first ?? rules.firstSide,
    activeSide: initiative.sides?.active ?? null,
  };
}

/** Draws the players' list into `container`; nothing while it has no combatants. */
export function renderPlayerInitiative(container: HTMLElement, list: PlayerInitiativeList, look: PlayerInitiativeLook): void {
  if (!list.combatants.length) return;
  const panel = container.createDiv({
    cls: 'atlas-player-initiative',
    attr: { role: 'region', 'aria-label': t('playerInit.order') },
  });
  if (list.bySides) {
    renderSides(panel, list, look);
  } else {
    renderTurnOrder(panel, list, look);
  }
  if (list.isActive) {
    panel.createDiv({ cls: 'atlas-player-initiative__round', text: t('playerInit.round', { round: list.round }) });
    // The list is drawn anew on every change, scrolled to its top: bring the turn back into view
    const entries = panel.querySelector<HTMLElement>('.atlas-player-initiative__list');
    const side = panel.querySelector('.atlas-player-initiative__side--active');
    const card = panel.querySelector('.atlas-player-initiative__card--active');
    if (entries && side) scrollWithin(entries, side, 'start');
    else if (entries && card) scrollWithin(entries, card, 'nearest');
  }
}

/** The combatants in turn order, those that delayed their turn below it until they act. */
function renderTurnOrder(panel: HTMLElement, list: PlayerInitiativeList, look: PlayerInitiativeLook): void {
  const entries = panel.createDiv({ cls: 'atlas-player-initiative__list', attr: { role: 'list' } });
  const delayed = list.combatants.filter(({ entry }) => entry.delayed);
  for (const combatant of list.combatants) {
    if (!combatant.entry.delayed) renderEntry(entries, combatant, look, list.isActive);
  }
  if (!delayed.length) return;
  const group = entries.createDiv({ cls: 'atlas-player-initiative__side', attr: { role: 'list', 'aria-label': t('playerInit.delayed') } });
  group.createDiv({ cls: 'atlas-player-initiative__side-label', text: t('playerInit.delayed'), attr: { 'aria-hidden': 'true' } });
  for (const combatant of delayed) renderEntry(group, combatant, look, false);
}

/** The combatants under their side, the side that acts first on top; a side the players see nobody of is left out. */
function renderSides(panel: HTMLElement, list: PlayerInitiativeList, look: PlayerInitiativeLook): void {
  const sides = panel.createDiv({ cls: 'atlas-player-initiative__list' });
  for (const side of sidesInOrder(list.firstSide)) {
    const members = list.combatants.filter(({ token }) => token.side === side);
    if (!members.length) continue;
    const group = sides.createDiv({ cls: 'atlas-player-initiative__side', attr: { role: 'list', 'aria-label': SIDE_LABELS[side] } });
    if (list.activeSide === side) {
      group.addClass('atlas-player-initiative__side--active');
      group.setAttribute('aria-current', 'true');
    }
    group.createDiv({ cls: 'atlas-player-initiative__side-label', text: SIDE_LABELS[side], attr: { 'aria-hidden': 'true' } });
    // By sides the turn is the side's and there are no numbers
    for (const member of members) renderEntry(group, member, look, false, false);
  }
}

function renderEntry(parent: HTMLElement, { entry, token }: Combatant, look: PlayerInitiativeLook, combatActive: boolean, showValue = true): void {
  const card = parent.createDiv({ cls: 'atlas-player-initiative__card', attr: { role: 'listitem' } });
  if (combatActive && entry.isActive) {
    card.addClass('atlas-player-initiative__card--active');
    card.setAttribute('aria-current', 'true');
  }
  if (entry.sitsOut) card.addClass('atlas-player-initiative__card--sitting-out');
  if (entry.delayed) card.addClass('atlas-player-initiative__card--delayed');
  const src = entry.imagePath ? look.portraitSrc(entry.imagePath) : null;
  const portrait = src
    ? createTokenPortrait(card, { src, alt: look.showNames ? entry.name : '', cls: 'atlas-player-initiative__avatar', showRing: token.showRing, ringColor: token.ringColor })
    : null;
  const badge = look.badgeNumber?.(entry.tokenId) ?? null;
  if (badge !== null) (portrait ?? card).createSpan({ cls: 'atlas-player-initiative__badge', text: String(badge) });
  if (token.defeated) renderDefeated(card, src !== null);
  // A combatant without a number yet shows a dash, not a 0 nobody rolled
  if (showValue) card.createSpan({ cls: 'atlas-player-initiative__value', text: hasInitiative(entry) ? String(entry.initiative) : '–' });
  if (look.showNames) {
    card.createSpan({ cls: 'atlas-player-initiative__name', text: entry.name });
  }
  const { hp } = token;
  if (hp && hp.max > 0) {
    card.createEl('progress', {
      cls: 'atlas-player-initiative__hp',
      attr: { max: hp.max, value: Math.max(0, hp.current), 'aria-label': 'HP' },
    });
  }
}

/** The GM card's skull, over a defeated combatant's portrait (in its place without one); the card is dimmed with it. */
function renderDefeated(card: HTMLElement, overPortrait: boolean): void {
  card.addClass('atlas-player-initiative__card--defeated');
  const mark = card.createSpan({ cls: 'atlas-player-initiative__defeated', attr: { role: 'img', 'aria-label': t('playerInit.defeated') } });
  if (overPortrait) mark.addClass('atlas-player-initiative__defeated--over');
  setIcon(mark, 'skull');
}

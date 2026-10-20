/**
 * What a player character's sheet offers of its recovery buttons, and checking a request to take
 * one against it. The GM builds the offer from the character as it is now (`restOffers`), sends it
 * with the sheet, and checks every request against an offer built afresh (`checkRest`), so a player
 * can never spend more than the character holds. Pure.
 */

import type { RecoveryButton } from './recoveryTypes';
import { restPlan } from './restPlan';
import type { RestCharacter, RestChoices } from './restTypes';

/** One Spend rule of a button as the player chooses it: how many units of `label`, 0 to `max`. */
export interface SpendOffer {
  /** The rule's place in its button. */
  readonly rule: number;
  /** The source spent ("Hit Dice"). */
  readonly label: string;
  /** What one unit gives (`1d8+(2)`). */
  readonly each: string;
  readonly max: number;
}

/** A button a character's sheet offers: its id and name, and the Spend rules the player chooses, in rule order. */
export interface RestOffer {
  readonly id: string;
  readonly name: string;
  readonly spends: readonly SpendOffer[];
}

/** A request to take a button: its id and how many units each of its offered Spend rules spends, in the offer's order. */
export interface RestRequest {
  readonly button: string;
  readonly spends: readonly number[];
}

/** The buttons `buttons` offers `character`, each with the Spend rules it can plan now. */
export function restOffers(buttons: readonly RecoveryButton[], character: RestCharacter): RestOffer[] {
  return buttons.map((button) => ({
    id: button.id,
    name: button.name,
    spends: restPlan(button, character).rules.flatMap((planned) => (planned.spend ? [{ rule: planned.index, ...planned.spend }] : [])),
  }));
}

/**
 * The button a request takes and the choices it makes, or null where it is refused: no offered
 * button has its id, it names another number of spends than the button offers, or one is no whole
 * number from 0 to its offer's `max`.
 */
export function checkRest(offers: readonly RestOffer[], request: RestRequest): { button: RestOffer; choices: RestChoices } | null {
  const button = offers.find((offer) => offer.id === request.button);
  if (!button || request.spends.length !== button.spends.length) return null;
  const fits = button.spends.every((offer, index) => {
    const units = request.spends[index];
    return typeof units === 'number' && Number.isInteger(units) && units >= 0 && units <= offer.max;
  });
  if (!fits) return null;
  return { button, choices: { spends: new Map(button.spends.map((offer, index) => [offer.rule, request.spends[index]!])) } };
}

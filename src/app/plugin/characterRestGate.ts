import type { App } from 'obsidian';
import { t } from '../i18n';
import type { CheckedRest, RestGate } from '../online/gm/book/restGate.ts';
import { restRulesText } from '../online/gm/book/restRules.ts';
import { quietRoll } from '../online/gm/quietRoll.ts';
import { characterRest, type CharacterRest } from '../recovery/characterRest';
import type { RecoveryButton } from '../recovery/recoveryTypes';
import { onRested } from '../recovery/restEvents';
import { checkRest, restOffers, type RestRequest } from '../recovery/restOffer';
import { restPlan } from '../recovery/restPlan';
import type { RestChoices, RestRoller } from '../recovery/restTypes';
import { takeRest } from '../recovery/takeRest';
import { diceSetOfCollection } from '../services/diceSets/collectionDiceSets';
import { templateDiceSet } from '../statblocks/resolve/templateDiceSet';
import { showNotice } from '../ui/notice';
import { randomHex } from '../utils/randomHex';

/** The player character `character` (its library token's id) whose statblock is the note at `path`, with buttons; null for any other. */
function restOf(app: App, path: string, character: string): CharacterRest | null {
  const rest = characterRest(app, path);
  return rest !== null && rest.asset.id === character && rest.buttons.length > 0 ? rest : null;
}

/** The request checked against what the character offers now: the button it takes and the choices it makes, or null. */
function checked(rest: CharacterRest, request: RestRequest): { button: RecoveryButton; choices: RestChoices } | null {
  const fit = checkRest(restOffers(rest.buttons, rest.character), request);
  const button = fit === null ? undefined : rest.buttons.find((each) => each.id === fit.button.id);
  return fit === null || button === undefined ? null : { button, choices: fit.choices };
}

/**
 * Rolls a rest's formulas on the dice of the character's statblock (its template's set, else its
 * collection's), quietly: the rest's log entry shows the rolls, no throw is on anyone's screen.
 */
function quietRoller(app: App, rest: CharacterRest): RestRoller {
  const dice = templateDiceSet(app, rest.notePath) ?? diceSetOfCollection(app, rest.asset.collection);
  return (formula) => {
    const roll = quietRoll(formula, dice, randomHex(12), Date.now());
    return roll === null ? null : { formula, total: roll.total };
  };
}

/**
 * The recovery buttons of the characters players play, as Atlas holds them: a character is read
 * from its note and its tokens as the note panel reads it (`characterRest`), a request is checked
 * against the buttons it offers now, and an approved rest is taken through the same engine as the
 * GM's own press, so it is announced to whoever follows the GM's rests (the table's log).
 */
export function characterRestGate(app: App): RestGate {
  return {
    offers: (path, character) => {
      const rest = restOf(app, path, character);
      return rest === null ? null : restOffers(rest.buttons, rest.character);
    },
    check: (path, character, request): CheckedRest | null => {
      const rest = restOf(app, path, character);
      const fit = rest === null ? null : checked(rest, request);
      if (rest === null || fit === null) return null;
      return { button: fit.button.name, rules: restRulesText(restPlan(fit.button, rest.character), fit.choices) };
    },
    take: async (path, character, request) => {
      const rest = restOf(app, path, character);
      const fit = rest === null ? null : checked(rest, request);
      if (rest === null || fit === null) return 'refused';
      const taken = await takeRest(app, rest, fit.button.id, fit.choices, quietRoller(app, rest));
      // The rest went through but its counters did not: the GM is told, as the note panel tells them.
      if (taken?.problem) showNotice(`${taken.summary.text}\n${t('rest.failed', { problem: taken.problem })}`);
      return taken === null ? 'refused' : 'done';
    },
    onRested: (listener) => onRested(app, listener),
  };
}

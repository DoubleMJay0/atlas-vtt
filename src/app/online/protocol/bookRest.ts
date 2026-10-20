import { bookLine, MAX_BOOK_TITLE } from './bookText.ts';
import { isRecord } from './shape.ts';
import { isPlainKey, spendText, type SheetBudget } from './sheetValues.ts';
import { MAX_TOKEN_VALUE } from './tokenUI.ts';

/** The most recovery buttons a statblock offers, the most spend rules one button has, and the longest id of a button. */
export const MAX_RECOVERY_BUTTONS = 6;
export const MAX_RECOVERY_SPENDS = 16;
export const MAX_RECOVERY_ID = 100;
/** A rest request's id, and the id the GM's Atlas gives a character for the table: 96 random bits in hex. */
export const REST_ID_PATTERN = /^[0-9a-f]{24}$/;

/**
 * Something a player spends on a rest, and how many of it at most they may spend now ("Hit Dice",
 * the lower of what they hold and the rule's cap). Each unit spent rolls once more what the rule rolls.
 */
export interface BookRecoverySpend {
  readonly label: string;
  readonly most: number;
}

/**
 * A recovery button of the character's statblock ("Short rest", "Long rest"): its id, which a
 * request names, its name, and its spend rules in their order, each asking the player how many.
 * What the rest restores is the GM's Atlas's to work out; the page only asks for it.
 */
export interface BookRecoveryButton {
  readonly id: string;
  readonly name: string;
  readonly spends: readonly BookRecoverySpend[];
}

/** What a player character's statblock (`BookStatblock`) carries for rests. */
export interface StatblockRest {
  /**
   * The id the GM's Atlas gives the character the sheet is of, for the table (random, never anything
   * of the vault), which a rest request names; sent with `recovery`.
   */
  readonly characterId?: string;
  /**
   * The character's recovery buttons, each a rest the player may ask the GM for (`book-rest`): only a
   * player character's statblock from a GM of level 2 or above has any, and never without `characterId`.
   */
  readonly recovery?: readonly BookRecoveryButton[];
}

/**
 * A player asks the GM for a rest of their character (`character`, the id its statblock names), by
 * the button's id, with how many units they spend for each of the button's spend rules, in order.
 * `request` is the page's own id for it, which the GM's answer names. A GM of level 2 or above reads it.
 */
export interface BookRestMessage {
  readonly t: 'book-rest';
  readonly request: string;
  readonly character: string;
  readonly button: string;
  readonly spends: readonly number[];
}

/**
 * The GM's answer to a rest request, to its player alone: the rest was taken (`done`), the GM said no
 * (`declined`), or the request did not fit what the sheet offers or came while another waited (`refused`).
 * A request the GM never answers (the player left, the table ended) gets none.
 */
export interface BookRestAnswer {
  readonly t: 'book-rest-answer';
  readonly request: string;
  readonly outcome: 'done' | 'declined' | 'refused';
}

const REST_OUTCOMES: readonly unknown[] = ['done', 'declined', 'refused'];

export const isRestId = (value: unknown): value is string => typeof value === 'string' && REST_ID_PATTERN.test(value);
export const isRecoveryId = (value: unknown): value is string => isPlainKey(value, MAX_RECOVERY_ID);
const isUnits = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_TOKEN_VALUE;

function parseSpend(value: unknown): BookRecoverySpend | null {
  if (!isRecord(value) || !isUnits(value.most)) return null;
  const label = bookLine(value.label, MAX_BOOK_TITLE);
  return label === null ? null : { label, most: value.most };
}

function parseButton(value: unknown): BookRecoveryButton | null {
  if (!isRecord(value) || !isRecoveryId(value.id) || !Array.isArray(value.spends) || value.spends.length > MAX_RECOVERY_SPENDS) return null;
  const name = bookLine(value.name, MAX_BOOK_TITLE);
  const spends = value.spends.map(parseSpend);
  if (name === null || spends.some((spend) => spend === null)) return null;
  return { id: value.id, name, spends: spends as BookRecoverySpend[] };
}

/** A statblock's recovery buttons, each id once; null when they are malformed. */
function parseRecovery(value: unknown): BookRecoveryButton[] | null {
  if (!Array.isArray(value) || value.length > MAX_RECOVERY_BUTTONS) return null;
  const buttons = value.map(parseButton);
  if (buttons.some((button) => button === null)) return null;
  const read = buttons as BookRecoveryButton[];
  return new Set(read.map((button) => button.id)).size === read.length ? read : null;
}

/** The rest fields of a statblock, each where it was sent, its texts spent from the statblock's budget; null when they are malformed. */
export function parseStatblockRest(value: Record<string, unknown>, budget: SheetBudget): StatblockRest | null {
  if (value.characterId === undefined && value.recovery === undefined) return {};
  if (!isRestId(value.characterId)) return null;
  if (value.recovery === undefined) return { characterId: value.characterId };
  const recovery = parseRecovery(value.recovery);
  if (recovery === null || !spendText(budget, recovery.map((button) => button.name + button.spends.map((spend) => spend.label).join('')).join(''))) return null;
  return { characterId: value.characterId, recovery };
}

/** A rest request as the GM reads it, or null when it is malformed. Whether it fits the sheet is the GM's to check. */
export function parseBookRestMessage(value: Record<string, unknown>): BookRestMessage | null {
  const { request, character, button, spends } = value;
  if (!isRestId(request) || !isRestId(character) || !isRecoveryId(button)) return null;
  if (!Array.isArray(spends) || spends.length > MAX_RECOVERY_SPENDS || !spends.every(isUnits)) return null;
  return { t: 'book-rest', request, character, button, spends: [...spends] };
}

/** The GM's answer to a rest request as the page reads it, or null when it is malformed. */
export function parseBookRestAnswer(value: Record<string, unknown>): BookRestAnswer | null {
  return isRestId(value.request) && REST_OUTCOMES.includes(value.outcome) ? { t: 'book-rest-answer', request: value.request, outcome: value.outcome as BookRestAnswer['outcome'] } : null;
}

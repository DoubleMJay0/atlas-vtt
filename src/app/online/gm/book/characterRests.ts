import {
  isRecoveryId, MAX_BOOK_TITLE, MAX_RECOVERY_BUTTONS, MAX_RECOVERY_SPENDS, MAX_TOKEN_VALUE, parseBookStatblock, type BookRecoveryButton, type BookRecoverySpend,
  type BookStatblock,
} from '../../protocol/index.ts';
import type { RestOffer } from '../../../recovery/restOffer';
import { cutLine } from '../shownText.ts';
import type { PlayedCharacter } from './characters.ts';
import { jsonBytes, MAX_STATBLOCK_BYTES } from './sheetBudget.ts';
import type { DrawnStatblock } from './statblockSheet.ts';

export interface CharacterRestPorts {
  /** A new id: 24 hex characters from the cryptographic source. */
  randomId(): string;
  /** The buttons the character offers now (`RestGate.offers`); null where it offers none. */
  offers(path: string, character: string): readonly RestOffer[] | null;
}

/** How many units of a spend the page may offer: what the offer says, a whole number the protocol carries. */
const mostOf = (max: number): number => (Number.isFinite(max) ? Math.max(0, Math.min(MAX_TOKEN_VALUE, Math.floor(max))) : 0);

/** A button as the page is sent it; null where it cannot be (an id the protocol does not carry, a name or spend that shows nothing). */
function bookButton(offer: RestOffer): BookRecoveryButton | null {
  const name = cutLine(offer.name, MAX_BOOK_TITLE);
  const spends = offer.spends.map((spend): BookRecoverySpend | null => {
    const label = cutLine(spend.label, MAX_BOOK_TITLE);
    return label === null ? null : { label, most: mostOf(spend.max) };
  });
  // A request names a count for each of the button's spends, in order: a button missing one is not offered at all.
  if (!isRecoveryId(offer.id) || name === null || spends.length > MAX_RECOVERY_SPENDS || spends.some((spend) => spend === null)) return null;
  return { id: offer.id, name, spends: spends as BookRecoverySpend[] };
}

/** The buttons as the page is sent them: each id once, as many as a statblock carries. */
function bookRecovery(offers: readonly RestOffer[]): BookRecoveryButton[] {
  const ids = new Set<string>();
  return offers.flatMap((offer) => bookButton(offer) ?? []).filter((button) => !ids.has(button.id) && ids.add(button.id)).slice(0, MAX_RECOVERY_BUTTONS);
}

/** Whether a statblock still reads as the page reads it and fits its message. */
const fits = (statblock: BookStatblock): boolean => parseBookStatblock(statblock) !== undefined && jsonBytes(statblock) <= MAX_STATBLOCK_BYTES;

/**
 * The recovery buttons of the characters players play, on the statblock each player is sent of their
 * own character (`BookStatblock.recovery`). A character carries them only where Atlas says it is the
 * player character of its note and it has buttons (`RestGate.offers`), named by an id of its own for
 * the table (`characterId`): random, made the first time, kept while the table runs, never anything
 * of the vault. What each Spend rule lets the player spend is read again whenever the statblock is
 * drawn anew, which its note or its resources changing does. A statblock the buttons would make too
 * large for the page is sent without them.
 */
export class CharacterRests {
  /** The id of each character's book key, and the book key of each id. */
  private readonly ids = new Map<string, string>();
  private readonly keys = new Map<string, string>();
  /** The last statblock decorated for each character, and what it became. */
  private readonly decorated = new Map<string, { readonly drawn: DrawnStatblock; readonly with: DrawnStatblock }>();

  constructor(private readonly ports: CharacterRestPorts) {}

  /** The statblock a character's player is sent: `drawn` with the character's buttons where it has any. */
  withRest(character: PlayedCharacter | null, drawn: DrawnStatblock | undefined): DrawnStatblock | undefined {
    if (character === null || drawn === undefined || drawn.statblock === null || character.statblockPath === null) return drawn;
    const last = this.decorated.get(character.key);
    if (last?.drawn === drawn) return last.with;
    const offers = this.ports.offers(character.statblockPath, character.key);
    const recovery = offers === null ? [] : bookRecovery(offers);
    const statblock = recovery.length === 0 ? null : { ...drawn.statblock, characterId: this.idOf(character.key), recovery };
    const decorated = statblock !== null && fits(statblock) ? { ...drawn, statblock } : drawn;
    this.decorated.set(character.key, { drawn, with: decorated });
    return decorated;
  }

  /** The book key of the character a request names by its table id; undefined for an id this table never gave. */
  characterOf(id: string): string | undefined {
    return this.keys.get(id);
  }

  /** What characters offer may have changed (a rest taken, a note changed): their buttons are read again with the next statblock. */
  forget(character?: string): void {
    if (character === undefined) this.decorated.clear();
    else this.decorated.delete(character);
  }

  private idOf(character: string): string {
    let id = this.ids.get(character);
    if (id === undefined) {
      id = this.ports.randomId();
      this.ids.set(character, id);
      this.keys.set(id, character);
    }
    return id;
  }
}

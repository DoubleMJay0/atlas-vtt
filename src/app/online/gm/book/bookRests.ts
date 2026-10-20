import { isRestId, parseBookRestMessage } from '../../protocol/index.ts';
import type { ArmedCards } from '../armedCards.ts';
import { CharacterRests } from './characterRests.ts';
import type { PlayedCharacter } from './characters.ts';
import type { RestGate } from './restGate.ts';
import { RestRequests, type RestCard } from './restRequests.ts';
import type { DrawnStatblock } from './statblockSheet.ts';

/** What a character without a name is called on its request's card. */
const UNNAMED = 'Unnamed character';

/** What the books' rests ask of the books and the table. */
export interface BookRestsHost {
  readonly rests: Pick<RestGate, 'offers' | 'check' | 'take'>;
  readonly cards: ArmedCards;
  randomId(): string;
  /** Answers a request, to its player alone. */
  answer(player: string, request: string, outcome: 'done' | 'declined' | 'refused'): void;
  /** The character a player plays now, or null. */
  character(player: string): PlayedCharacter | null;
  /** Whether a player is connected and within their rate of writes into their book. */
  mayWrite(player: string): boolean;
  /** The player is sent their statblock again, whatever it reads. */
  resend(player: string): void;
  /** The requests' cards changed. */
  changed(): void;
}

/**
 * Rests at a running table: the recovery buttons on each player's own character's statblock
 * (`CharacterRests`), and the requests they send (`book-rest`), which wait for the GM as cards
 * (`RestRequests`). A request is taken only from a connected player within their rate, for the
 * character they play now, by the id this table gave it; anything else is refused at once, except
 * past the player's rate, which is answered with nothing.
 */
export class BookRests {
  private readonly sheets: CharacterRests;
  private readonly requests: RestRequests;

  constructor(private readonly host: BookRestsHost) {
    this.sheets = new CharacterRests({ randomId: () => host.randomId(), offers: (path, character) => host.rests.offers(path, character) });
    this.requests = new RestRequests({
      check: (path, character, request) => host.rests.check(path, character, request),
      take: (path, character, request) => host.rests.take(path, character, request),
      plays: (player, character) => host.character(player)?.key === character,
      answer: (player, answer) => host.answer(player, answer.request, answer.outcome),
      rested: (player, character) => {
        this.sheets.forget(character);
        host.resend(player);
      },
      changed: () => host.changed(),
    }, host.cards);
  }

  /** The statblock a character's player is sent, with the character's buttons where it has any. */
  withRest(character: PlayedCharacter | null, drawn: DrawnStatblock | undefined): DrawnStatblock | undefined {
    return this.sheets.withRest(character, drawn);
  }

  /** The requests waiting for the GM, as cards. */
  cards(): readonly RestCard[] {
    return this.requests.view();
  }

  approve(key: string): void {
    this.requests.approve(key);
  }

  decline(key: string): void {
    this.requests.decline(key);
  }

  /** A player's rest request: waits for the GM, or is refused at once; one past the player's rate of writes gets no answer. */
  receive(from: string, body: Record<string, unknown>): void {
    // Checked first, so a flood of requests, readable or not, draws no answers.
    if (!this.host.mayWrite(from)) return;
    const message = parseBookRestMessage(body);
    if (message === null) {
      // A request the page named can be refused; one it did not name cannot be answered.
      if (isRestId(body.request)) this.host.answer(from, body.request, 'refused');
      return;
    }
    const character = this.host.character(from);
    const key = this.sheets.characterOf(message.character);
    const path = character?.statblockPath ?? null;
    const asked = character !== null && key === character.key && path !== null && this.requests.ask({
      player: from, request: message.request, character: key, characterId: message.character, name: character.sheet.name || UNNAMED, path,
      ask: { button: message.button, spends: message.spends },
    });
    if (!asked) this.host.answer(from, message.request, 'refused');
  }

  /** A note may read otherwise (every note for null): what characters offer is read again. */
  changed(): void {
    this.sheets.forget();
  }

  /** A player left the table: their requests go, unanswered. */
  playerLeft(player: string): void {
    this.requests.playerLeft(player);
  }

  /** The table is over: every request goes, unanswered. */
  stop(): void {
    this.requests.dispose();
  }
}

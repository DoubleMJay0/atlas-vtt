import type { BookRestAnswer } from '../../protocol/index.ts';
import type { RestRequest } from '../../../recovery/restOffer';
import type { ArmedCards } from '../armedCards.ts';
import type { CheckedRest, TakenRest } from './restGate.ts';

/** A player's rest request as the GM is shown it: a card over the online control. */
export interface RestCard {
  /** The card's key among the cards over the control (one request per character). */
  readonly key: string;
  /** The name of the character who asks, as their sheet has it. */
  readonly character: string;
  readonly button: string;
  /** What the rest will do, rule by rule. */
  readonly rules: readonly string[];
  /** The card has stood in its place for `ARM_MS`: until then it takes no answer, and looks it. */
  readonly armed: boolean;
  /** The GM approved and the rest is being taken. */
  readonly answered: boolean;
}

/** A request that came in, checked: who asks, for which character, what. */
export interface AskedRest {
  readonly player: string;
  /** The page's own id of the request, which the answer names. */
  readonly request: string;
  /** The character by the key of its book, and by its table id, which names its card. */
  readonly character: string;
  readonly characterId: string;
  readonly name: string;
  /** The character's statblock note. */
  readonly path: string;
  readonly ask: RestRequest;
}

export interface RestRequestPorts {
  check(path: string, character: string, request: RestRequest): CheckedRest | null;
  take(path: string, character: string, request: RestRequest): Promise<TakenRest>;
  /** Whether the player plays the character still. */
  plays(player: string, character: string): boolean;
  /** Answers a request, to its player alone. */
  answer(player: string, answer: BookRestAnswer): void;
  /** The character rested: what it offers may be other now, and its player is sent their statblock again. */
  rested(player: string, character: string): void;
  /** Anything the cards show changed. */
  changed(): void;
}

interface Pending extends AskedRest {
  readonly card: RestCard;
}

/** A rest request's card among the cards over the control (`ArmedCards`). */
export const restKey = (characterId: string): string => `rest:${characterId}`;

/**
 * Players' rest requests while the GM decides: each a card over the online control, in the order
 * they came, at most one per character. A request is checked against what its character offers when
 * it comes (`check`), and its card takes no answer until it has stood for the cards' arming time.
 * Approve takes the rest (checked again, rolled, written and logged by Atlas) and tells the player
 * it was done, or refused where it no longer fits; Decline tells them no. A request whose player
 * left goes without an answer, as do all when the table ends; while the player is there and the
 * table runs, every request is answered.
 */
export class RestRequests {
  private list: readonly Pending[] = [];
  private readonly heard = (): void => {
    if (this.refresh()) this.ports.changed();
  };
  private readonly stopListening: () => void;
  private disposed = false;

  constructor(private readonly ports: RestRequestPorts, private readonly cards: ArmedCards) {
    this.stopListening = cards.listen(this.heard);
  }

  /** The cards, in the order the requests came. */
  view(): readonly RestCard[] {
    return this.list.map((pending) => pending.card);
  }

  /** A request came: it waits for the GM where it fits what the character offers and no other of the character's waits. False where it is refused. */
  ask(asked: AskedRest): boolean {
    if (this.disposed || this.list.some((pending) => pending.character === asked.character)) return false;
    const checked = this.ports.check(asked.path, asked.character, asked.ask);
    if (checked === null) return false;
    const key = restKey(asked.characterId);
    this.cards.show(key, this.heard);
    const card: RestCard = { key, character: asked.name, button: checked.button, rules: checked.rules, armed: false, answered: false };
    this.list = [...this.list, { ...asked, card }];
    this.refresh();
    this.ports.changed();
    return true;
  }

  /** The GM approves a request: the rest is taken, and its player told how it went. Nothing while the card has not stood long enough to be meant. */
  approve(key: string): void {
    const pending = this.answerable(key);
    if (pending === null) return;
    this.list = this.list.map((other) => (other === pending ? { ...other, card: { ...other.card, answered: true } } : other));
    this.ports.changed();
    const taken = this.ports.plays(pending.player, pending.character) ? this.ports.take(pending.path, pending.character, pending.ask) : Promise.resolve<TakenRest>('refused');
    void taken.catch((error: unknown): TakenRest => {
      console.error('[Atlas] Taking a player\'s rest failed:', error);
      return 'refused';
    }).then((outcome) => {
      if (this.disposed || !this.list.some((other) => other.card.key === pending.card.key)) return;
      this.remove(pending.card.key);
      this.ports.answer(pending.player, { t: 'book-rest-answer', request: pending.request, outcome });
      if (outcome === 'done') this.ports.rested(pending.player, pending.character);
    });
  }

  /** The GM declines a request: its player is told, nothing changes. */
  decline(key: string): void {
    const pending = this.answerable(key);
    if (pending === null) return;
    this.remove(key);
    this.ports.answer(pending.player, { t: 'book-rest-answer', request: pending.request, outcome: 'declined' });
  }

  /** A player left the table: their requests go, unanswered. */
  playerLeft(player: string): void {
    for (const pending of this.list.filter((other) => other.player === player)) this.remove(pending.card.key);
  }

  /** The table is over: every request goes, unanswered, and its card with it. */
  dispose(): void {
    this.disposed = true;
    this.stopListening();
    for (const pending of this.list) this.cards.drop(pending.card.key, this.heard);
    this.list = [];
  }

  private answerable(key: string): Pending | null {
    const pending = this.list.find((other) => other.card.key === key);
    return pending === undefined || pending.card.answered || !pending.card.armed ? null : pending;
  }

  private remove(key: string): void {
    if (!this.list.some((pending) => pending.card.key === key)) return;
    this.list = this.list.filter((pending) => pending.card.key !== key);
    // The others close up: one of them may take the place of the card that was just pressed.
    this.cards.remove(key, this.heard);
    this.refresh();
    this.ports.changed();
  }

  /** Each card's `armed` as the clock says; whether any changed. */
  private refresh(): boolean {
    let flipped = false;
    this.list = this.list.map((pending) => {
      const armed = this.cards.isArmed(pending.card.key);
      if (pending.card.armed === armed) return pending;
      flipped = true;
      return { ...pending, card: { ...pending.card, armed } };
    });
    return flipped;
  }
}

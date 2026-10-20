import { parseAsset, type AssetRef } from './asset.ts';
import { isRecord } from './shape.ts';
import { COLOUR_PATTERN, MAX_NAME } from './tokens.ts';
import { MAX_TOKEN_CONDITIONS, parseCondition, type SharedCondition } from './tokenUI.ts';

/** Combatants one `initiative` message may list. */
export const MAX_COMBATANTS = 200;
export const INITIATIVE_SIDES = ['players', 'opponents'] as const;
export type SharedSide = (typeof INITIATIVE_SIDES)[number];

/** A combatant on the players' initiative list: never one whose token is hidden. */
export interface SharedCombatant {
  readonly initiative: number;
  /** Shown only while the player view shows names. */
  readonly name: string | null;
  /** The combatant has the turn (in turn order, while a fight runs). */
  readonly turn: boolean;
  readonly sitsOut: boolean;
  /** Delayed its turn: waits outside the order until it acts. Absent from older GMs. */
  readonly delayed?: true;
  /** Defeated, as the GM's card shows it: drawn dimmed and marked. Absent from older GMs. */
  readonly defeated?: true;
  /** No number rolled or typed yet: an empty slot, not the 0 `initiative` holds. Absent from older GMs. */
  readonly unnumbered?: true;
  /**
   * In a list that starts at the turn (`SharedInitiative.fromTurn`), the combatant acts in the next
   * round: it is drawn after the round's last, below a divider naming the next round. Absent from older GMs.
   */
  readonly nextRound?: true;
  /** The condition badges the map shows players on the combatant's token, in order. Absent from older GMs. */
  readonly conditions?: readonly SharedCondition[];
  /** The portrait's artwork, asked for by hash like the map. */
  readonly art: AssetRef | null;
  /** The ring around the portrait (`#rrggbb`, or null untinted); absent for an unframed token. */
  readonly ring: { readonly colour: string | null } | null;
  readonly side: SharedSide;
  /** Hit points, where the collection shows them to players. */
  readonly hp: { readonly current: number; readonly max: number } | null;
}

/** The players' initiative list, as Atlas's player window shows it. */
export interface SharedInitiative {
  readonly isActive: boolean;
  readonly round: number;
  readonly bySides: boolean;
  readonly firstSide: SharedSide;
  readonly activeSide: SharedSide | null;
  readonly combatants: readonly SharedCombatant[];
  /**
   * The GM's lists start at the turn during a fight: in turn order the combatants without
   * `nextRound` first, then a divider, then those with it; by sides the side whose turn it is first,
   * then a divider before the sides that act before it. Absent: the list in turn order.
   */
  readonly fromTurn?: true;
}

const isNumber = (value: unknown, limit: number): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
const isSide = (value: unknown): value is SharedSide => INITIATIVE_SIDES.includes(value as SharedSide);

function parseCombatant(value: unknown): SharedCombatant | null {
  if (!isRecord(value) || !isNumber(value.initiative, 1e9) || typeof value.turn !== 'boolean' || typeof value.sitsOut !== 'boolean' || !isSide(value.side)) return null;
  const { name, ring, hp } = value;
  if (name !== null && (typeof name !== 'string' || name.length > MAX_NAME)) return null;
  const art = value.art === null ? null : parseAsset(value.art);
  if (value.art !== null && art === null) return null;
  if (ring !== null && (!isRecord(ring) || (ring.colour !== null && (typeof ring.colour !== 'string' || !COLOUR_PATTERN.test(ring.colour))))) return null;
  if (hp !== null && (!isRecord(hp) || !isNumber(hp.current, 1e9) || !isNumber(hp.max, 1e9))) return null;
  return {
    initiative: value.initiative, name, turn: value.turn, sitsOut: value.sitsOut, art, side: value.side,
    ring: ring === null ? null : { colour: ring.colour as string | null },
    hp: hp === null ? null : { current: hp.current as number, max: hp.max as number },
    // Optional flags: anything but `true` reads as unset, so a page never fails on them
    ...(value.delayed === true ? { delayed: true as const } : {}),
    ...(value.defeated === true ? { defeated: true as const } : {}),
    ...(value.unnumbered === true ? { unnumbered: true as const } : {}),
    ...(value.nextRound === true ? { nextRound: true as const } : {}),
    ...conditionsOf(value.conditions),
  };
}

/** Optional condition badges: a list of readable ones, else unset, so a page never fails on them. */
function conditionsOf(value: unknown): { conditions?: SharedCondition[] } {
  if (!Array.isArray(value) || value.length > MAX_TOKEN_CONDITIONS) return {};
  const conditions: SharedCondition[] = [];
  for (const entry of value) {
    const condition = parseCondition(entry);
    if (condition === null) return {};
    conditions.push(condition);
  }
  return { conditions };
}

/** The list of an `initiative` message: null for none shown, undefined for anything malformed. */
export function parseInitiative(value: unknown): SharedInitiative | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.isActive !== 'boolean' || typeof value.bySides !== 'boolean' || !isNumber(value.round, 1e9) || !isSide(value.firstSide)) return undefined;
  if (value.activeSide !== null && !isSide(value.activeSide)) return undefined;
  if (!Array.isArray(value.combatants) || value.combatants.length > MAX_COMBATANTS) return undefined;
  const combatants: SharedCombatant[] = [];
  for (const entry of value.combatants) {
    const combatant = parseCombatant(entry);
    if (combatant === null) return undefined;
    combatants.push(combatant);
  }
  return {
    isActive: value.isActive, round: value.round, bySides: value.bySides, firstSide: value.firstSide, activeSide: value.activeSide, combatants,
    ...(value.fromTurn === true ? { fromTurn: true as const } : {}),
  };
}

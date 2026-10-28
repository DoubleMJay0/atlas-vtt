import type { DungeonRiverBridge } from '../../model';
import { bridgePoint, DECK_HALF, deckOf } from '../../forest/riverShape';
import { hash2 } from '../art/noise';
import { castShadow, type Hand } from '../art/hand';
import { polyPath, polysPath } from '../art/paths';
import { pointsBounds, type Vec } from '../geometry';

/**
 * A Forest river's footbridges: planks laid across two log beams that rest on the banks, a rail of
 * thin poles along each side, the deck's shadow on the water below. Every direction draws them with
 * its own wood.
 */
export function drawRiverBridges(hand: Hand, bridges: readonly DungeonRiverBridge[]): void {
  for (const bridge of bridges) footbridge(hand, bridge);
}

function footbridge(hand: Hand, bridge: DungeonRiverBridge): void {
  const { at, length } = bridge;
  const point = (u: number, v: number): Vec => bridgePoint(bridge, u, v);
  const deck = deckOf(bridge);
  castShadow(hand, polyPath(deck), 0.6, pointsBounds(deck), 0.7);
  const seed = Math.floor(at.x * 7919 + at.y * 104729);
  const half = DECK_HALF * 0.86;
  const planks: Vec[][] = [];
  let u = 0.04;
  for (let k = 0; u < length - 0.1; k++) {
    const w = 0.15 + 0.04 * hash2(k, 1, seed);
    const skew = (hash2(k, 2, seed) - 0.5) * 0.04;
    const shift = (hash2(k, 3, seed) - 0.5) * 0.06;
    // Here and there a plank is short of its neighbours, as an old deck's are.
    const short = hash2(k, 4, seed) < 0.15 ? 0.08 : 0;
    planks.push([point(u + skew, -half + shift + short), point(u + w + skew, -half + shift + short), point(u + w - skew, half + shift), point(u - skew, half + shift)]);
    u += w + 0.025;
  }
  hand.surface(polysPath(planks), 'wood');
  for (const plank of planks) hand.edges(plank, true);
  // Each side's rail of thin poles and the three posts that hold it, turned with the bridge.
  const rail = DECK_HALF - 0.04;
  for (const side of [-1, 1]) {
    hand.line([Array.from({ length: 9 }, (_, k) => point(0.12 + ((length - 0.24) * k) / 8, side * rail + (hash2(k, side, seed) - 0.5) * 0.02))], 'heavy');
    for (const along of [0.12, length / 2, length - 0.12]) {
      const post = [point(along - 0.06, side * rail - 0.06), point(along + 0.06, side * rail - 0.06), point(along + 0.06, side * rail + 0.06), point(along - 0.06, side * rail + 0.06)];
      hand.surface(polyPath(post), 'wood');
      hand.edges(post, true);
    }
  }
}

/** How far a path runs on from a bridge's end into the clearing before it fades, in cells. */
const APPROACH = 2.6;

/** A worn path onto a bridge's end: its outline and how strong it is where it lies (0..1, fading away from the bridge). */
export interface Approach {
  ring: Vec[];
  fade: (p: Vec) => number;
}

/**
 * The paths onto the bridges' ends that no trail already leads to: a bridge on the way through the
 * clearings is reached over worn ground that fades into the grass a few cells off, so it reads as
 * part of a path and not a deck set down on the bank.
 */
export function bridgeApproaches(bridges: readonly DungeonRiverBridge[], onTrail: (p: Vec) => boolean): Approach[] {
  return bridges.flatMap((bridge) => [0, bridge.length].flatMap((u): Approach[] => {
    const start = bridgePoint(bridge, u, 0);
    if (onTrail(start)) return [];
    const out = u === 0 ? -1 : 1;
    const point = (along: number, v: number): Vec => bridgePoint(bridge, u + out * along, v);
    const ring = [point(-0.1, -0.42), point(APPROACH * 0.5, -0.46), point(APPROACH, -0.3), point(APPROACH, 0.3), point(APPROACH * 0.5, 0.46), point(-0.1, 0.42)];
    const fade = (p: Vec): number => 1 - Math.max(0, Math.min(1, ((p.x - start.x) * bridge.along.x + (p.y - start.y) * bridge.along.y) * out / APPROACH)) ** 1.5;
    return [{ ring, fade }];
  }));
}

/** The line the woods keep off along a bridge: its deck, and its approaches where it has them (`bridgeApproaches`), end to end. */
export function bridgeSpan(bridge: DungeonRiverBridge, onTrail: (p: Vec) => boolean): [Vec, Vec] {
  const reach = (u: number): number => (onTrail(bridgePoint(bridge, u, 0)) ? 0 : APPROACH);
  return [bridgePoint(bridge, -reach(0), 0), bridgePoint(bridge, bridge.length + reach(bridge.length), 0)];
}

/**
 * The culmination: a normal room among the farthest from the entrance, the larger the likelier.
 * Its subtree is the culmination wing; an approach wing may lie before it. The door into the
 * first of them becomes the locked gate, and the room in front of it describes the gate.
 */

import { type Rng, chance, int, weighted } from '../rng';
import {
  GATED_ZONE,
  type WorkLayout,
  ancestry,
  floorArea,
  isNormal,
  liveRooms,
  roomAt,
  subtree,
  treeDoorInto,
} from '../layout/workLayout';
import { type FeatureMap, addFeature } from './features';

export interface Culmination {
  ending: number;
  /** The room behind the gate: the culmination itself or the head of its approach. */
  gateRoot: number;
  /** The room in front of the gate; null when there is no gate. */
  front: number | null;
}

/** Only rooms this close to the farthest one may be the culmination. */
const FAR_SHARE = 0.75;

function pickEnding(rng: Rng, layout: WorkLayout, costs: readonly number[]): number {
  const candidates = liveRooms(layout).filter((room) => room.id !== 0 && isNormal(room) && Number.isFinite(costs[room.id]));
  if (candidates.length === 0) return 0;
  const far = Math.max(...candidates.map((room) => costs[room.id] ?? 0));
  const pool = candidates.filter((room) => (costs[room.id] ?? 0) >= far * FAR_SHARE);
  return weighted(rng, pool.map((room) => [room.id, floorArea(room)] as const));
}

/** Half the time the gate stands one or two rooms earlier, so an approach leads to the end. */
function pickGateRoot(rng: Rng, layout: WorkLayout, ending: number): number {
  let root = ending;
  if (ending === 0 || !chance(rng, 0.5)) return root;
  const limit = Math.max(2, Math.floor(liveRooms(layout).length / 3));
  for (let steps = int(rng, 1, 2); steps > 0; steps--) {
    const parent = roomAt(layout, root).parent;
    if (parent === null || parent === 0 || subtree(layout, parent).length > limit) break;
    root = parent;
  }
  return root;
}

function antechamber(rng: Rng, layout: WorkLayout, culmination: Culmination, features: FeatureMap): void {
  const path = ancestry(layout, culmination.ending);
  const approach = path.slice(path.indexOf(culmination.gateRoot), -1).filter((id) => isNormal(roomAt(layout, id)));
  const room = approach[approach.length - 1];
  if (room === undefined) return;
  const approachSize = liveRooms(layout).filter((r) => r.wing === 'approach').length;
  if (!chance(rng, 1 - approachSize / liveRooms(layout).length)) return;
  addFeature(features, room, { kind: 'enemy' });
  addFeature(features, room, { kind: 'environment' });
}

export function placeCulmination(rng: Rng, layout: WorkLayout, costs: readonly number[], features: FeatureMap): Culmination {
  const ending = pickEnding(rng, layout, costs);
  const gateRoot = pickGateRoot(rng, layout, ending);
  const front = gateRoot === 0 ? null : roomAt(layout, gateRoot).parent;
  const culmination: Culmination = { ending, gateRoot, front };
  roomAt(layout, ending).ending = true;
  addFeature(features, ending, { kind: 'enemy' });
  if (front === null) return culmination;
  const inCulmination = new Set(subtree(layout, ending));
  for (const id of subtree(layout, gateRoot)) {
    const room = roomAt(layout, id);
    room.wing = inCulmination.has(id) ? 'culmination' : 'approach';
    room.zone = GATED_ZONE;
  }
  const gate = treeDoorInto(layout, gateRoot);
  if (gate) gate.kind = 'gate';
  antechamber(rng, layout, culmination, features);
  return culmination;
}

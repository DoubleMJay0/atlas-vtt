/**
 * Steps: a change of floor level at an ordinary door. The fewer doors the room behind it has, the
 * likelier, and twice as likely at each end that is a junction.
 */

import type { DoorKind } from '../model';
import type { DungeonParams } from '../params';
import { chance, stream } from '../rng';
import { type WorkLayout, doorsOf, kindOf, roomAt } from './workLayout';

const ORDINARY: ReadonlySet<DoorKind> = new Set<DoorKind>(['door', 'doorway', 'open']);

export function addSteps(seed: number, layout: WorkLayout, params: DungeonParams): void {
  if (params.stepsChance <= 0) return;
  const rng = stream(seed, 'layout', 'steps');
  for (const door of layout.doors) {
    if (door.from === null || door.to === null || !ORDINARY.has(door.kind)) continue;
    const from = roomAt(layout, door.from);
    const to = roomAt(layout, door.to);
    let p = params.stepsChance / Math.max(1, doorsOf(layout, to.id).length);
    if (kindOf(from) === 'junction') p *= 2;
    if (kindOf(to) === 'junction') p *= 2;
    if (chance(rng, p)) door.kind = 'steps';
  }
}

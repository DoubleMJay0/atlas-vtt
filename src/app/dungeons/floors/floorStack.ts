/**
 * Which way a dungeon's floors stack. Floors keep their planning order (index 0 is the entrance
 * floor, each next one farther from it); the stack says where each lies: below the last in a
 * Cavern, above it in a Fortress or Haunted Mansion. Every "is this floor below that one" asks here.
 */

import type { DungeonModel } from '../model';
import { THEMES } from '../themes/themes';
import type { ThemeId } from '../themes/themeTypes';
import type { StairEnd } from './stairSpots';

/** Where each next floor lies: above the entrance floor (`up`) or below it (`down`). */
export type FloorRise = 'up' | 'down';

export interface FloorStack {
  readonly rise: FloorRise;
  readonly count: number;
}

export function floorStack(rise: FloorRise, count: number): FloorStack {
  return { rise, count };
}

/** A model's stack, from its theme; a model without one (an older export) goes down. */
export function stackOf(model: Pick<DungeonModel, 'floors'> & { theme?: ThemeId }): FloorStack {
  return floorStack(model.theme ? THEMES[model.theme].rise : 'down', model.floors.length);
}

function step(stack: FloorStack, floor: number, toward: 1 | -1): number | null {
  const next = floor + toward;
  return next >= 0 && next < stack.count ? next : null;
}

/** The floor physically under `floor`, or null where none lies there. */
export function floorBelow(stack: FloorStack, floor: number): number | null {
  return step(stack, floor, stack.rise === 'down' ? 1 : -1);
}

/** The floor physically over `floor`, or null where none lies there. */
export function floorAbove(stack: FloorStack, floor: number): number | null {
  return step(stack, floor, stack.rise === 'down' ? -1 : 1);
}

/** Whether floor `a` lies above floor `b`. */
export function isAbove(stack: FloorStack, a: number, b: number): boolean {
  return stack.rise === 'down' ? a < b : a > b;
}

/** The end of a stairwell on `floor` that leads to `to`: its upper end where `floor` lies above. */
export function stairEnd(stack: FloorStack, floor: number, to: number): StairEnd {
  return isAbove(stack, floor, to) ? 'upper' : 'lower';
}

/** The floors from the top of the stack to its bottom. */
export function topDown(stack: FloorStack): number[] {
  const order = Array.from({ length: stack.count }, (_, k) => k);
  return stack.rise === 'down' ? order : order.reverse();
}

/** The floors from the bottom of the stack to its top. */
export function bottomUp(stack: FloorStack): number[] {
  return topDown(stack).reverse();
}

/** A floor's elevation in game units, `height` a floor, the entrance floor from 0 to `height`. */
export function levelElevation(stack: FloorStack, floor: number, height: number): { bottom: number; top: number } {
  // + 0 writes the entrance floor of a Cavern as 0, not −0.
  const bottom = (stack.rise === 'down' ? -1 : 1) * floor * height + 0;
  return { bottom, top: bottom + height };
}

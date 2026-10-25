import type { PathFn } from '../../art/paths';
import type { Vec } from '../../geometry';
import type { GlyphPen } from '../../glyphPen';
import { charredFuel, fireGlow, flames, type Tongue } from '../fire/burning';
import { ASH_DOTS, inBox, logsIn } from './parts';
import type { Part } from './shapes';

/**
 * A lit fireplace's fuel: the cold fire's two logs burnt black, embers glowing along their splits,
 * sparks on the hearth between them and small flames licking up from them, leaning back towards the
 * flue (+y), over a bed that glows from the middle of the firebox.
 */

interface BurningFuel {
  middle: Vec;
  glow: { rx: number; ry: number };
  logs: PathFn;
  splits: number[];
  sparks: (readonly [number, number, number])[];
  tongues: Tongue[];
}

/** Each flame as shares of the firebox: where it stands, how it leans off straight back and its size; they lick up from the two logs. */
const FLAMES: readonly (readonly [number, number, number, number])[] = [
  [-0.24, -0.16, -0.3, 0.8], [-0.05, -0.13, -0.08, 1], [0.15, -0.17, 0.15, 0.85],
  [-0.14, 0.13, -0.2, 0.9], [0.08, 0.15, 0.06, 1.05], [0.26, 0.12, 0.32, 0.75],
];

function burningFuelIn(b: Part): BurningFuel {
  const { logs, splits } = logsIn(b);
  return {
    middle: { x: b.x, y: b.y },
    glow: { rx: b.w * 0.75, ry: b.h * 0.95 },
    logs,
    splits,
    sparks: ASH_DOTS.map(([x, y]) => {
      const p = inBox(b, x, y);
      return [p.x, p.y, 0.012] as const;
    }),
    tongues: FLAMES.map(([x, y, side, size]) => {
      const len = Math.hypot(side, 1);
      return { at: inBox(b, x, y), r: b.h * 0.12 * size, length: b.h * 0.42 * size, lean: { x: side / len, y: 1 / len } };
    }),
  };
}

const fuels = new WeakMap<Part, BurningFuel>();

/** The burning fuel lying at `b` in a firebox whose recess is `bed`: glow, charred logs with their embers, then the flames over them. */
export function burningFuel(pen: GlyphPen, b: Part, bed: PathFn): void {
  let fuel = fuels.get(b);
  if (!fuel) {
    fuel = burningFuelIn(b);
    fuels.set(b, fuel);
  }
  fireGlow(pen, bed, fuel.middle, fuel.glow.rx, fuel.glow.ry);
  charredFuel(pen, fuel.logs, fuel.splits, fuel.sparks);
  flames(pen, fuel.tongues);
}

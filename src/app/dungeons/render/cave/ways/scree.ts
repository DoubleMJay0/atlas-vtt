import { stackOf, stairEnd } from '../../../floors/floorStack';
import type { CellDir } from '../../../model';
import { rngFrom } from '../../../rng';
import type { Hand } from '../../art/hand';
import { hash2 } from '../../art/noise';
import { polyPath, polysPath } from '../../art/paths';
import type { Vec } from '../../geometry';
import { stoneOutline } from '../../terrain/stones';
import { doorFrame, wayFrame, type WayFrame } from './narrows';
import { shaftSides } from './shafts';

/** Loose chips become heavier stones down the slope; there are no ruled stair treads. */
function slope(hand: Hand, frame: WayFrame): void {
  const { at, along, across, bounds } = frame;
  const seed = hand.scene.env.dungeon.model.seed;
  const rng = rngFrom(hash2(bounds.minX, bounds.minY, seed) * 0x7fffffff);
  const end = along / 2 - 0.045;
  const stones: { poly: Vec[]; c: Vec; r: number }[] = [];
  const rows = Math.max(3, Math.ceil(along * 2));
  const columns = Math.max(2, Math.ceil(across * 1.5));
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const t = (row + 0.15 + rng() * 0.7) / rows;
    const u = ((col + 0.12 + rng() * 0.76) / columns - 0.5) * (across - 0.28);
    const v = (t - 0.5) * (along - 0.28);
    const r = 0.035 + 0.072 * t + rng() * 0.025;
    const c = at(u, v);
    stones.push({ poly: stoneOutline(rng, c, r), c, r });
  }
  hand.surface(polysPath(stones.map(s => s.poly)), 'rock');
  for (const s of stones.slice(-2)) hand.solid(polyPath(s.poly), s.c, s.r, frame.progress(s.c.x, s.c.y));
  hand.line(stones.filter(s => s.r <= 0.08).map(s => s.poly), 'fine', true);
  hand.line(stones.filter(s => s.r > 0.08).map(s => s.poly), 'outline', true);
  // Broken runnels connect the scatter without making a regular grid.
  hand.line([-0.28, 0.22].map(u => [at(u * across, -end * 0.62), at((u + 0.05) * across, -end * 0.16), at((u - 0.02) * across, end * 0.36)]), 'fine');
}

export function drawScree(hand: Hand): void {
  const { dungeon } = hand.scene.env;
  for (const door of dungeon.doors) {
    if (door.kind !== 'steps') continue;
    const down = door.descends ? door.dir : { x: -door.dir.x, y: -door.dir.y } as CellDir;
    slope(hand, doorFrame(door, down));
  }
  for (const stair of dungeon.floor.stairs) {
    if (stair.way !== 'scree') continue;
    const frame = wayFrame(stair, stair.down);
    slope(hand, frame);
    shaftSides(hand, frame, stairEnd(stackOf(dungeon.model), dungeon.index, stair.to));
  }
}

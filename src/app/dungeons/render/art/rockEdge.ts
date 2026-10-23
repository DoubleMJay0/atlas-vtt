import type { ArtScene } from './artScene';
import { mouthsOf, partedRock } from './mouths';
import { noiseSampler } from './noise';
import { smoothstep } from './paths';

/**
 * How much of the natural rock round the walls stands at each point, 0..1, for every direction:
 * whole against the walls and in the pockets the rooms close in on, ending in a broken edge that
 * wanders in and out at every scale (bays a few cells long, spurs, chips), farther out here and
 * nearer there, and parting before every way in.
 */
export function rockCoverage(scene: ArtScene, softness = 0.025): (x: number, y: number) => number {
  const { env } = scene;
  const seed = env.dungeon.model.seed;
  const reach = noiseSampler(seed + 1, 12, 3, 3);
  const bays = noiseSampler(seed + 2, 4, 3, 3);
  const spurs = noiseSampler(seed + 3, 1.2, 3, 3);
  const chips = noiseSampler(seed + 4, 0.45, 3, 2);
  const base = env.style.surround.reach;
  const parted = partedRock(mouthsOf(env.dungeon));
  return (x, y) => {
    if (scene.pocketAt(x, y) > 0.5) return 1;
    const d = scene.sdfAt(x, y);
    if (d > base * 1.8 + 0.6) return 0;
    const r = base * (0.55 + 0.6 * reach(x, y));
    const wander = (bays(x, y) - 0.5) * 0.9 + (spurs(x, y) - 0.5) * 0.45 + (chips(x, y) - 0.5) * 0.18;
    const edge = d + wander * Math.min(1, d / 0.5);
    return smoothstep(r + softness, r - softness, edge) * parted(x, y);
  };
}

import type { ArtScene } from './artScene';
import { mouthsOf, partedRock } from './mouths';
import { noiseSampler } from './noise';
import { smoothstep } from './paths';
import { closeField, fieldOf } from './raster';

/**
 * How much of the natural rock round the walls stands at each sample of the scene's grid, 0..1, for every direction:
 * whole against the walls and in the pockets the rooms close in on, ending in a broken edge that
 * wanders in and out at every scale (bays a few cells long, spurs, chips), farther out here and
 * nearer there, never leaving a hole between rooms, and parting before every way in.
 */
export function rockCoverage(scene: ArtScene, softness = 0.025): Float32Array {
  const { env } = scene;
  const seed = env.dungeon.model.seed;
  const reach = noiseSampler(seed + 1, 12, 3, 3);
  // One wander at every scale: bays a few cells long down to chips a fraction of a cell.
  const wander = noiseSampler(seed + 2, 6, 2, 6);
  const base = env.style.surround.reach;
  const parted = partedRock(mouthsOf(env.dungeon), seed + 5);
  const reached = fieldOf(scene.grid, (x, y) => {
    const d = scene.sdfAt(x, y);
    // Under the floors the rock is whole (the floor lies over it), so the closing never opens a wall.
    if (d < 0.05) return 1;
    if (d > base * 1.8 + 0.6) return scene.pocketAt(x, y) > 0.5 ? 1 : 0;
    if (scene.pocketAt(x, y) > 0.5) return 1;
    const r = base * (0.55 + 0.6 * reach(x, y));
    const edge = d + (wander(x, y) - 0.5) * 1.5 * Math.min(1, d / 0.5);
    return smoothstep(r + softness, r - softness, edge);
  });
  // Rock between rooms stands whole: gaps and holes narrower than two cells close up.
  const closed = closeField(scene.grid, reached, scene.grid.res * CLOSE);
  return fieldOf(scene.grid, (x, y, k) => closed[k]! * parted(x, y));
}

/** Half the widest gap in the rock that closes up, in cells. */
const CLOSE = 1.1;

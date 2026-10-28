import type { ArtScene } from '../art/artScene';
import type { Hand, Material } from '../art/hand';
import { polysPath, type PathFn } from '../art/paths';
import { depthField } from '../art/pools';
import { engravedHand } from '../engraved/hand';
import type { Pens } from '../engraved/pens';
import { CRAYONS, MATERIAL_CRAYONS } from './colours';
import type { CrayonBox } from './crayonBox';
import { crayonWater, depthStrength } from './pools';

/**
 * Crayon's hand: Engraved's lines, shade hatching and modelling in graphite, every surface
 * coloured in with its material's crayon (a floor left bare), water in blue crayon heavier as it
 * deepens and molten rock in ember over flame.
 */
export function crayonHand(scene: ArtScene, pens: Pens, box: CrayonBox): Hand {
  const lines = engravedHand(scene, pens);
  const water = crayonWater(box);
  const colour = (path: PathFn, material: Material): void => {
    const fill = MATERIAL_CRAYONS[material];
    if (fill) box.colourIn(path, fill);
  };
  const hand: Hand = {
    ...lines,
    surface: (path, material) => {
      lines.surface(path, material);
      colour(path, material);
    },
    fill: (path, material) => {
      lines.fill(path, material);
      colour(path, material);
    },
    grain: (path, material) => {
      lines.grain(path, material);
      colour(path, material);
    },
    water: (pools, depth, deep) => water(scene, pens, polysPath(pools), pools, depth, deep),
    lava: (pools, tint) => {
      lines.lava(pools, tint);
      const path = polysPath(pools);
      if (tint === 'acid') {
        box.colourIn(path, { colour: CRAYONS.acid, cover: 0.9, passes: 3 });
        return;
      }
      const depth = depthField(scene, path, pools.flat());
      box.colourIn(path, { colour: CRAYONS.flame, cover: 0.9, passes: 2 });
      box.colourIn(path, { colour: CRAYONS.ember, cover: 0.9, passes: 3 }, depthStrength(depth));
    },
  };
  return hand;
}

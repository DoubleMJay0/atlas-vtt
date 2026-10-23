import type { Stand } from '../art/heights';
import { WALL_SHADOW } from '../art/light';
import { growthPicture } from '../growth/growthForms';
import { silhouette } from '../growth/leafGeometry';
import type { RenderEnv } from '../renderEnv';

/** A plant's height for every cell its shadow lifts (`PlantForm.lift`): the map casts a wall's shadow `WALL_SHADOW` long, a plant's a little shorter than its height would. */
const HEIGHT_PER_LIFT = 0.75 / WALL_SHADOW;
const LOWEST = 0.03;
const TALLEST = 0.4;

/**
 * The plants on a floor as what stands (`growthPicture`'s ground: grass, ferns, fungi, roots,
 * undergrowth), each as tall as the shadow the map gives it says, as one silhouette of its leaves,
 * stems and caps. Climbers grow on the walls, which stand a wall high already, and column climbers
 * on columns; moss lies flat.
 */
export function plantStands(env: RenderEnv): Stand[] {
  return growthPicture(env).ground.map((form) => ({
    height: Math.min(TALLEST, Math.max(LOWEST, form.lift * HEIGHT_PER_LIFT)),
    path: silhouette(form),
  }));
}

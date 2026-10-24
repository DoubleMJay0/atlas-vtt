import type { FamilyGlyphs } from '../../propShapes';
import { campfire, campfireSilhouette } from './campfire';

/**
 * What those who live in caves leave: a fire ring of stones round its ash. One drawing, which asks
 * its painter how to finish every part: Stone fills and textures it, Engraved leaves it paper and
 * cuts its material and shade in lines.
 */
export const GLYPHS: FamilyGlyphs = {
  campfire: { material: 'rock', radius: 0.42, lift: 0.1, silhouette: campfireSilhouette, stone: campfire, engraved: campfire },
};

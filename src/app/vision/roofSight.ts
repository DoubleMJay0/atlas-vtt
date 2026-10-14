/**
 * Where the players see a roof: from above the walls, so walls do not hide it, by the ambient light
 * alone (a lamp beneath lights the floor, not the roof). A sense that shows the map sees a roof
 * within its reach and its cone, where it perceives in the ambient light there. Out of that, no roof
 * is drawn for them, and the floor beneath shows as their sight leaves it (or their memory of it).
 */

import { NORMAL_SIGHT } from '../gameSystems/senses/generic';
import { perceivedLevel, showsMap } from '../gameSystems/senseRules';
import type { TokenEntity } from '../types';
import type { LightLevel, SenseDefinition } from '../types/senseTypes';
import type { Point } from '../types/visionTypes';
import type { Sight } from './sight';
import { coneContains, visionCone, type VisionCone } from './visionCone';

/** A sense that sees roofs: one that shows the map, with its reach and the cone its token looks in. */
export interface RoofViewer {
  origin: Point;
  radius: number;
  cone?: VisionCone | undefined;
  sense: SenseDefinition;
}

/** Who sees roofs: everyone wherever normal sight perceives (sight that is all), or these senses. */
export type RoofViewers = 'all' | readonly RoofViewer[];

/**
 * The senses of `sight` that see roofs, each with the cone of its token for a sense of the eyes
 * (a region's polygon was cut to it, which roofs do not read). `tokens` holds every token whose
 * regions `sight` has, on whichever level.
 */
export function roofViewers(sight: Sight, tokens: Readonly<Record<string, TokenEntity>>): RoofViewers {
  if (sight.all) return 'all';
  return sight.regions.flatMap((region) => {
    if (!showsMap(region.sense)) return [];
    const token = tokens[region.tokenId];
    const eyes = !region.sense.worksWhileBlinded;
    const cone = region.cone ?? (eyes && token?.vision ? visionCone(token.rotation, token.vision.angle, region.apex) : undefined);
    return [{ origin: region.origin, radius: region.radius, cone, sense: region.sense }];
  });
}

/** Whether `viewer` reaches `point` from above: within its radius and its cone, whatever walls stand between. */
export function reachesFromAbove(viewer: RoofViewer, point: Point): boolean {
  const { origin, radius, cone } = viewer;
  if (Math.hypot(point.x - origin.x, point.y - origin.y) > radius) return false;
  return !cone || coneContains(cone, origin, point);
}

/**
 * Whether the players see a roof at `point`, where the ambient light alone is at `level`
 * (`ambientLevelOn`). Sight that is all (no vision token in the scene, or token vision off) sees
 * it wherever normal sight perceives in that light.
 */
export function roofSeenAt(point: Point, viewers: RoofViewers, level: LightLevel): boolean {
  if (viewers === 'all') return perceivedLevel(NORMAL_SIGHT, level) !== null;
  return viewers.some((viewer) => perceivedLevel(viewer.sense, level) !== null && reachesFromAbove(viewer, point));
}

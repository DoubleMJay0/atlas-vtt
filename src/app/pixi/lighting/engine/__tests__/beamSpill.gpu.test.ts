import { afterEach, describe, expect, it } from 'vitest';
import { BEAM_SLIDER } from '../../../../lighting/lightBeam';
import { LIGHT_LEVELS, LIGHT_REACH, beamEdge } from '../../../../lighting/lightingConstants';
import { lightLevelAt } from '../../../../vision/lightLevels';
import { lightReach } from '../../../../vision/sight';
import { engineLight } from '../../../../vision/lightSources';
import { LightingWorld } from '../LightingWorld';
import type { EngineLight } from '../types';
import type { LightEmission } from '../../../../types/lightingTypes';
import { createTestRenderer, readFloats } from './gpuTestUtils';

const SCALE = { unitDistance: 5, cellSize: 70 };
const emission = { bright: 60, dim: 120, color: '#ffffff', intensity: 1, animation: 'none' as const, sourceRadius: 1 };
/** The bright and dim radii of the built-in lights, in feet, and a short light of 10 and 20 ft. */
const PRESET_RADII = [[0, 10], [5, 10], [10, 20], [15, 45], [20, 40], [20, 60], [30, 30], [40, 40], [30, 60], [60, 60], [60, 120]] as const;
/** Beam widths from the slider's narrowest to nearly all around, in degrees. */
const ANGLES = [BEAM_SLIDER.min, 20, 30, 45, 53, 60, 90, 120, 180, 270, 355];

describe('how much a light lights that the rules do not count', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  /**
   * The texels the light map lights to at least half the dim level where the rule counts nothing
   * as lit, as a share of the texels the rule counts: a token standing there is hidden on a
   * floor that looks lit. That is the tail (`LIGHT_TAIL`), past the dim radius and a beam's
   * sides, which Fabian accepted for the look (2026-10-23): it is measured and held to a ceiling,
   * and nothing at all may be lit past the tail (`beyond`). The light stands in the middle of a
   * map just large enough for it.
   */
  async function uncounted(light: Partial<LightEmission> & { rotation?: number }): Promise<number> {
    const { rotation, ...changes } = light;
    const lit = { ...emission, ...changes };
    const side = Math.ceil(((lit.dim * SCALE.cellSize) / SCALE.unitDistance) * 2.3) + 200;
    const renderer = await createTestRenderer(64);
    cleanup.push(() => renderer.destroy());
    const world = new LightingWorld(renderer, { width: side, height: side });
    cleanup.push(() => world.destroy());
    const drawn = engineLight({ key: 'light', x: side / 2, y: side / 2, ...(rotation !== undefined && { rotation }), emission: lit }, SCALE);
    world.update([], [drawn], null);
    world.flush();
    const texels = readFloats(renderer, world.lightMap.texture);
    const width = world.lightMap.texture.source.pixelWidth;
    const reach = [lightReach({ x: drawn.x, y: drawn.y }, drawn.dim, [], drawn.bright, drawn)];
    let counted = 0;
    let stray = 0;
    let beyond = 0;
    const margin = 2 * world.texel;
    for (let o = 0; o < texels.length; o += 4) {
      const point = { x: ((o / 4) % width + 0.5) * world.texel, y: (Math.floor(o / 4 / width) + 0.5) * world.texel };
      if (lightLevelAt(point, { ambient: 0 }, reach) !== 'dark') counted++;
      else if (texels[o]! >= LIGHT_LEVELS.dim / 2) stray++;
      if (texels[o]! > 1e-4 && pastTail(point, drawn, margin, world.texel)) beyond++;
    }
    while (cleanup.length) cleanup.pop()!();
    expect(beyond).toBe(0);
    return stray / counted;
  }

  /** Whether `point` lies past a light's tail: past its reach, or past a beam's soft side and its own space's. */
  function pastTail(point: { x: number; y: number }, light: EngineLight, margin: number, texel: number): boolean {
    const d = Math.hypot(point.x - light.x, point.y - light.y);
    if (d > light.dim * LIGHT_REACH + margin) return true;
    const { cone } = light;
    if (!cone || !light.edge || d <= (cone.apex ?? 0) + beamEdge(light.edge, cone.apex ?? 0, cone.angle, texel) + margin) return false;
    const turned = Math.abs(((Math.atan2(point.y - light.y, point.x - light.x) - cone.facing + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    const off = turned - cone.angle / 2;
    const across = off < Math.PI / 2 ? d * Math.sin(Math.max(off, 0)) : d;
    return across > beamEdge(light.edge, d, cone.angle, texel) + margin;
  }

  // Measured on the maintainer's machine (2026-10-23): all around 27.6 %, the bullseye beam 42.0 %.
  it('lights nothing past the tail, and no more past the rule than its tail', async () => {
    const allAround = await uncounted({});
    const beam = await uncounted({ rotation: 90, angle: 53 });
    console.info(`uncounted lit area, share of the counted: all around ${(allAround * 100).toFixed(1)} %, bullseye beam ${(beam * 100).toFixed(1)} %`);
    expect(allAround).toBeLessThan(0.3);
    expect(beam).toBeLessThan(0.45);
  });

  // The worst were lights bright to their end (60/60 ft), 55 %, whose tail starts at the bright level.
  it('stays within the tail for every beam the slider makes of every built-in light, the narrowest and shortest too', { timeout: 600_000 }, async () => {
    const shares: { angle: number; bright: number; dim: number; share: number }[] = [];
    for (const [bright, dim] of PRESET_RADII) {
      for (const angle of ANGLES) shares.push({ angle, bright, dim, share: await uncounted({ bright, dim, angle, rotation: 35 }) });
    }
    const worst = [...shares].sort((a, b) => b.share - a.share).slice(0, 6);
    const named = (list: typeof shares): string => list.map(({ angle, bright, dim, share }) => `${angle}° ${bright}/${dim} ft ${(share * 100).toFixed(1)} %`).join(', ');
    console.info(`uncounted lit area of beams, worst: ${named(worst)}`);
    console.info(`uncounted lit area of beams, the review's cases: ${named(shares.filter(({ angle, dim }) => [15, 30, 53].includes(angle) && [20, 40, 120].includes(dim)))}`);
    expect(worst[0]!.share).toBeLessThan(0.6);
  });
});

import { describe, expect, it } from 'vitest';
import {
  TURN_LOOK, arcLayout, arcPolygons, arcTaper, glowAlpha, glowAlphaAt, glowExtent, glowSpread, glowTextureSize, markerAppearance,
} from '../../src/app/pixi/token-renderer/turnMarker/turnMarkerShape';

describe('the turn glow', () => {
  it('rises over the token\'s soft edge to its peak, then falls smoothly to nothing at its reach', () => {
    expect(glowAlpha(-TURN_LOOK.glowInset)).toBe(0);
    expect(glowAlpha(0)).toBeCloseTo(TURN_LOOK.rimAlpha + TURN_LOOK.poolAlpha);
    let previous = glowAlpha(0);
    for (let distance = 0.5; distance <= TURN_LOOK.glowReach; distance += 0.5) {
      const alpha = glowAlpha(distance);
      expect(alpha).toBeLessThan(previous);
      previous = alpha;
    }
    expect(glowAlpha(TURN_LOOK.glowReach)).toBe(0);
    // No edge of its own: the last step before its reach is all but nothing
    expect(glowAlpha(TURN_LOOK.glowReach - 0.5)).toBeLessThan(0.001);
  });

  it('spreads further around a larger token, never less than around a medium one', () => {
    expect(glowSpread(35)).toBe(1);
    expect(glowSpread(10)).toBe(1);
    expect(glowSpread(140)).toBe(2);
    const huge = glowExtent(140, 1);
    expect(huge.radius).toBe(140 + 2 * TURN_LOOK.glowReach);
    expect(glowAlpha(TURN_LOOK.glowReach, 2)).toBeGreaterThan(0);
  });

  it('reads the same glow from its texture\'s shares as from distances', () => {
    const extent = glowExtent(35, 2);
    // The token's edge, and halfway out to the glow's reach
    expect(glowAlphaAt(extent.edgeShare, extent)).toBeCloseTo(glowAlpha(0));
    const halfway = (35 + TURN_LOOK.glowReach) / extent.radius;
    expect(glowAlphaAt(halfway, extent)).toBeCloseTo(glowAlpha(TURN_LOOK.glowReach / 2));
    expect(glowAlphaAt(1, extent)).toBeCloseTo(0, 9);
  });

  it('takes about four texels per world unit, as a power of two between 256 and 1024', () => {
    expect(glowTextureSize(10)).toBe(256);
    expect(glowTextureSize(61)).toBe(512);
    expect(glowTextureSize(100)).toBe(1024);
    expect(glowTextureSize(500)).toBe(1024);
  });
});

describe('the turn arcs', () => {
  it('lie on the diagonals, clear of the handles at the top and sides and of the bars below', () => {
    const polygons = arcPolygons(60, 3);
    expect(polygons).toHaveLength(TURN_LOOK.arcs);
    for (const polygon of polygons) {
      for (const { x, y } of polygon) {
        const angle = Math.atan2(y, x);
        // Every cardinal direction keeps a gap of about 15 degrees either side
        const fromCardinal = Math.min(...[0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI].map((cardinal) => Math.abs(angle - cardinal)));
        expect(fromCardinal).toBeGreaterThan((14 * Math.PI) / 180);
        expect(Math.hypot(x, y)).toBeGreaterThanOrEqual(60 - 1.5 - 1e-9);
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(60 + 1.5 + 1e-9);
      }
    }
  });

  it('taper from their full width in the middle to points', () => {
    expect(arcTaper(0)).toBe(1);
    expect(arcTaper(1)).toBe(0);
    expect(arcTaper(-1)).toBe(0);
    expect(arcTaper(0.5)).toBeGreaterThan(arcTaper(0.9));
  });

  it('keep the map\'s proportions, never thinner than a line nor with a heavy dark edge', () => {
    expect(arcLayout(35, 1, 1)).toEqual({ radius: 35 + TURN_LOOK.arcGap, width: TURN_LOOK.arcWidth, keyline: 1 });
    expect(arcLayout(35, 1, 3).radius).toBe(3 * (35 + TURN_LOOK.arcGap));
    expect(arcLayout(35, 1, 3).width).toBe(3 * TURN_LOOK.arcWidth);
    expect(arcLayout(35, 1, 3).keyline).toBe(TURN_LOOK.keylineMax);
    expect(arcLayout(35, 1, 0.25).width).toBe(TURN_LOOK.arcMinWidth);
    // Around a larger token they stand off and thicken with its glow
    expect(arcLayout(140, 1, 1)).toMatchObject({ radius: 140 + 2 * TURN_LOOK.arcGap, width: 2 * TURN_LOOK.arcWidth });
  });

  it('follow their curve to a twentieth of a pixel however far the map is zoomed in', () => {
    const [arc] = arcPolygons(2000, 0);
    const outer = arc!.slice(0, arc!.length / 2);
    for (let index = 1; index < outer.length; index += 1) {
      const a = outer[index - 1]!;
      const b = outer[index]!;
      const middle = Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2);
      expect(Math.hypot(a.x, a.y) - middle).toBeLessThan(0.05);
    }
  });
});

describe('the marker landing', () => {
  it('lands from a little larger, fading in, its arcs turning into place', () => {
    expect(markerAppearance(0)).toEqual({ alpha: 0, scale: TURN_LOOK.appearFrom, turn: TURN_LOOK.appearTurn });
    const landed = markerAppearance(1);
    expect([landed.alpha, landed.scale, Math.abs(landed.turn)]).toEqual([1, 1, 0]);
    const halfway = markerAppearance(0.5);
    expect(halfway.scale).toBeGreaterThan(1);
    expect(halfway.scale).toBeLessThan(TURN_LOOK.appearFrom);
  });
});

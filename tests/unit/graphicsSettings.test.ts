import { describe, expect, it } from 'vitest';
import { GRAPHICS_KNOBS, GRAPHICS_PRESETS, knobsOf, parseGraphicsChoice, presetOf, qualityOf, withKnob } from '../../src/app/lighting/graphicsSettings';
import { LIGHTING_QUALITY, LIGHTING_QUALITY_LEVELS } from '../../src/app/lighting/lightingQuality';

describe('the Graphics page\'s choices', () => {
  it('describe each preset exactly as the lighting quality table has it', () => {
    for (const level of LIGHTING_QUALITY_LEVELS) expect(qualityOf(GRAPHICS_PRESETS[level])).toEqual(LIGHTING_QUALITY[level]);
  });

  it('name the preset a set of knobs is, and none for a mix of its own', () => {
    for (const level of LIGHTING_QUALITY_LEVELS) expect(presetOf(GRAPHICS_PRESETS[level])).toBe(level);
    expect(presetOf({ ...GRAPHICS_PRESETS.high, liquids: 10 })).toBeNull();
  });

  it('apply an override over the preset, and drop one set back to the preset\'s own', () => {
    const choice = withKnob({ preset: 'balanced', overrides: {} }, 'litMap', 'sharp');
    expect(choice).toEqual({ preset: 'balanced', overrides: { litMap: 'sharp' } });
    expect(knobsOf(choice).litMap).toBe('sharp');
    expect(qualityOf(knobsOf(choice))).not.toHaveProperty('compositePixelRatio');
    expect(withKnob(choice, 'litMap', 'standard')).toEqual({ preset: 'balanced', overrides: {} });
  });

  it('give the polygon picture no bounce, flicker or rays, whatever those knobs say', () => {
    const quality = qualityOf({ ...GRAPHICS_PRESETS.high, picture: 'polygons' });
    expect(quality).toEqual({ picture: 'polygons', maxTexels: LIGHTING_QUALITY.high.maxTexels, liquidFps: 30 });
  });

  it('read a stored choice back and drop what is no choice', () => {
    expect(parseGraphicsChoice({ preset: 'saver', overrides: { liquids: 30, flames: 'wild', detail: 7 } })).toEqual({ preset: 'saver', overrides: { liquids: 30 } });
    expect(parseGraphicsChoice({ preset: 'ultra' })).toBeNull();
    expect(parseGraphicsChoice('high')).toBeNull();
    expect(parseGraphicsChoice({ preset: 'high' })).toEqual({ preset: 'high', overrides: {} });
    expect(GRAPHICS_KNOBS).toHaveLength(7);
  });
});

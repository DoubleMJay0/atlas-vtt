import { describe, expect, it } from 'vitest';
import { shadingSizeAllowed } from '../../../src/app/pixi/shading/shadingImages';
import { readPngText, withPngText } from '../../../src/app/utils/pngText';

describe('relief and shade images a scene file names', () => {
  it('are decoded only at the sizes the generator writes, never a large picture', () => {
    expect(shadingSizeAllowed({ width: 2400, height: 1600 })).toBe(true);
    expect(shadingSizeAllowed({ width: 16000, height: 8000 })).toBe(false);
    expect(shadingSizeAllowed({ width: 9000, height: 100 })).toBe(false);
    expect(shadingSizeAllowed({ width: 0, height: 100 })).toBe(false);
    expect(shadingSizeAllowed(null)).toBe(false);
  });
});

/** The smallest PNG these helpers read: the signature, a header chunk of 13 bytes and an end chunk (contents and CRCs unchecked). */
function pngHeader(): Uint8Array {
  const out = new Uint8Array(8 + 12 + 13 + 12);
  out.set([137, 80, 78, 71, 13, 10, 26, 10]);
  out.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  out.set([0, 0, 0, 0, 73, 69, 78, 68], 33);
  return out;
}

describe('a PNG text note', () => {
  it('is read back where Atlas wrote it, and never past its length limit', () => {
    expect(readPngText(withPngText(pngHeader(), 'atlas', 'hatch 1'), 'atlas')).toBe('hatch 1');
    expect(readPngText(withPngText(pngHeader(), 'atlas', 'x'.repeat(70 * 1024)), 'atlas')).toBeNull();
  });
});

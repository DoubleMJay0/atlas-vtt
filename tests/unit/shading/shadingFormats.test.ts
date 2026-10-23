import { describe, expect, it } from 'vitest';
import { readPngText, withPngText } from '../../../src/app/utils/pngText';
import { readShadeHatch, shadeHatchText } from '../../../src/app/lighting/shadeHatch';
import { RELIEF_BLOCK, RELIEF_GROUP, reliefBlocks } from '../../../src/app/lighting/reliefBlocks';
import { pngHeader } from '../../fixtures/uvttFiles';

describe('a PNG\'s text chunk', () => {
  it('is written after the header and read back, and nothing else of the picture changes', () => {
    // A header chunk with its check, then the end: the smallest file the reader walks.
    const png = new Uint8Array([...pngHeader(40, 30), 1, 2, 3, 4, 0, 0, 0, 0, 73, 69, 78, 68, 0xae, 0x42, 0x60, 0x82]);
    const marked = withPngText(png, 'atlas-shade-hatch', '{"a":1}');
    expect(readPngText(marked, 'atlas-shade-hatch')).toBe('{"a":1}');
    expect(readPngText(marked, 'other')).toBeNull();
    expect(readPngText(png, 'atlas-shade-hatch')).toBeNull();
    expect(Array.from(marked.subarray(0, 33))).toEqual(Array.from(png.subarray(0, 33)));
    expect(Array.from(marked.subarray(marked.length - (png.length - 33)))).toEqual(Array.from(png.subarray(33)));
    // Bytes that are no PNG are left as they are.
    const text = new TextEncoder().encode('no picture at all, but long enough to look like one');
    expect(withPngText(text, 'k', 'v')).toBe(text);
  });
});

describe('a shade\'s hatching', () => {
  const hatch = { ink: '#111111', spacing: 2.2, angle: -Math.PI / 4, offset: -1289.7, minWidth: 0.3 };

  it('reads back as it was written', () => {
    expect(readShadeHatch(shadeHatchText(hatch))).toEqual(hatch);
  });

  it('is none where the image says nothing Atlas can draw', () => {
    for (const text of [null, '', 'not json', '[]', JSON.stringify({ ...hatch, ink: 'red' }), JSON.stringify({ ...hatch, spacing: 0 }), JSON.stringify({ ...hatch, spacing: 1e9 }), JSON.stringify({ ...hatch, angle: 'up' })]) {
      expect(readShadeHatch(text)).toBeNull();
    }
    expect(readShadeHatch(JSON.stringify({ ...hatch, minWidth: -1 }))?.minWidth).toBe(0);
  });
});

describe('a relief\'s blocks', () => {
  it('hold the highest height of each block and the texels round it, and of its group', () => {
    const width = RELIEF_BLOCK * RELIEF_GROUP * 2;
    const height = RELIEF_BLOCK * 3;
    const heights = new Uint8Array(width * height);
    // One raised texel at the far edge of block (2, 1), next to block (3, 1).
    heights[(RELIEF_BLOCK + 1) * width + RELIEF_BLOCK * 3 - 1] = 200;
    const { data, columns, rows } = reliefBlocks(heights, width, height);
    expect([columns, rows]).toEqual([RELIEF_GROUP * 2, 3]);
    const block = (x: number, y: number): [number, number] => [data[(y * columns + x) * 4]!, data[(y * columns + x) * 4 + 1]!];
    expect(block(2, 1)).toEqual([200, 200]);
    // Its neighbour reads it bilinearly: it counts there too.
    expect(block(3, 1)).toEqual([200, 200]);
    expect(block(4, 1)).toEqual([0, 200]);
    expect(block(2, 0)[0]).toBe(0);
    // The next group knows nothing of it.
    expect(block(RELIEF_GROUP, 1)).toEqual([0, 0]);
  });
});

import { afterAll, describe, expect, it } from 'vitest';
import germaniaUrl from '../../src/app/assets/fonts/germania-one.ttf?url';
import pathwayUrl from '../../src/app/assets/fonts/pathway-gothic-one.ttf?url';
import { DUNGEON_FONT_FAMILIES } from '../../src/app/dungeons/render/fonts';
import { dungeonWalls } from '../../src/app/dungeons/scene/toWalls';
import { DEFAULT_VIEW, STYLE_PRESETS } from '../../src/app/dungeons/style';
import { DungeonWorkerClient } from '../../src/app/dungeons/worker/DungeonWorkerClient';
import DungeonWorker from '../../src/app/dungeons/worker/dungeonWorker?worker&inline';
import type { DungeonJob } from '../../src/app/dungeons/worker/dungeonJob';
import { imageDimensions } from '../../src/app/imageProcessing/imageDimensions';

/** The real worker, end to end: generation, fonts, drawing and the image it hands back. */

const STYLE = STYLE_PRESETS.parchment;
// An inline worker lives at a blob address, where a font's path means nothing
const absolute = (url: string): string => new URL(url, location.href).href;

const client = new DungeonWorkerClient({
  createWorker: () => new DungeonWorker({ name: 'Atlas dungeons (test)' }),
  fonts: () => [
    { family: DUNGEON_FONT_FAMILIES.title, source: `url("${absolute(germaniaUrl)}")` },
    { family: DUNGEON_FONT_FAMILIES.text, source: `url("${absolute(pathwayUrl)}")` },
  ],
});

afterAll(() => client.dispose());

const job = (output: DungeonJob['output'], seed = 7): DungeonJob => ({ request: { seed, tags: ['medium'] }, style: STYLE, view: DEFAULT_VIEW, output });

describe('the dungeon worker', () => {
  it('generates a dungeon and draws its floor plan as a PNG of the map layout\'s size', async () => {
    const result = await client.render(job({ kind: 'map', pxPerCell: 60, numbers: true }));

    expect(result.model.seed).toBe(7);
    expect(result.model.rooms.length).toBeGreaterThan(3);
    expect(result.image.type).toBe('png');
    if (result.image.type !== 'png' || !result.map) throw new Error('No map');
    expect(await imageDimensions(result.image.blob)).toEqual({ width: result.map.widthPx, height: result.map.heightPx });
    expect(result.map.pxPerCell).toBe(60);
    const walls = dungeonWalls(result.model, STYLE, DEFAULT_VIEW, result.map);
    expect(Object.keys(walls.walls).length).toBeGreaterThan(10);
  });

  it('draws the same dungeon for the same seed', async () => {
    const [a, b] = await Promise.all([client.render(job({ kind: 'map', pxPerCell: 20, numbers: false })), client.render(job({ kind: 'map', pxPerCell: 20, numbers: false }))]);
    if (a.image.type !== 'png' || b.image.type !== 'png') throw new Error('No PNG');
    expect(a.model).toEqual(b.model);
    expect(new Uint8Array(await a.image.blob.arrayBuffer())).toEqual(new Uint8Array(await b.image.blob.arrayBuffer()));
  });

  it('draws a page as a bitmap, and answers only the latest of several previews', async () => {
    const stale = client.preview(job({ kind: 'page', width: 700, height: 500 }, 1));
    const latest = client.preview(job({ kind: 'page', width: 700, height: 500 }, 2));

    const result = await latest;
    expect(await stale).toBeNull();
    if (!result || result.image.type !== 'bitmap') throw new Error('No bitmap');
    expect([result.image.bitmap.width, result.image.bitmap.height]).toEqual([700, 500]);
    expect(result.model.seed).toBe(2);
    expect(result.page?.rooms.length).toBe(result.model.rooms.length);
    result.image.bitmap.close();
  });
});

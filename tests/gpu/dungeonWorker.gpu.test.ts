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

  it('leaves the paper out of a map asked for transparent', async () => {
    const alphaAtCorner = async (transparent: boolean): Promise<number> => {
      const result = await client.render(job({ kind: 'map', pxPerCell: 20, numbers: false, transparent }));
      if (result.image.type !== 'png') throw new Error('No PNG');
      const bitmap = await createImageBitmap(result.image.blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, 1, 1).data[3]!;
    };
    expect(await alphaAtCorner(true)).toBe(0);
    expect(await alphaAtCorner(false)).toBe(255);
  });

  it('arranges note boxes anew for another arrangement, and keeps a box the GM placed', async () => {
    const first = await client.render(job({ kind: 'page', width: 1400, height: 1000 }, 3));
    const model = first.model;
    const placed = { ...model, notes: model.notes.map((note, i) => (i === 0 ? { ...note, manual: { x: model.rooms[0]!.x - 3, y: model.rooms[0]!.y - 3 } } : note)) };
    const boxes = async (arrangement: number): Promise<{ room: number; x: number; y: number }[]> => {
      const result = await client.render({ ...job({ kind: 'page', width: 1400, height: 1000, arrangement }, 3), model: placed });
      if (result.image.type === 'bitmap') result.image.bitmap.close();
      return result.page!.notes.map((note) => ({ room: note.room, x: Math.round(note.rect.x), y: Math.round(note.rect.y) }));
    };
    const [a, again, b] = [await boxes(0), await boxes(0), await boxes(1)];
    expect(again).toEqual(a);
    expect(b[0]).toEqual(a[0]);
    expect(b.slice(1)).not.toEqual(a.slice(1));
  });

  it('draws a page as SVG', async () => {
    const result = await client.render(job({ kind: 'page', width: 700, height: 500, svg: true }));
    if (result.image.type !== 'svg') throw new Error('No SVG');
    expect(result.image.svg.startsWith('<svg')).toBe(true);
    expect(result.image.svg).toContain('<text');
    expect(result.page?.rooms.length).toBe(result.model.rooms.length);
  });
});

import { describe, it } from 'vitest';
import { DEFAULT_VIEW, type DungeonView } from '../../src/app/dungeons/style';
import { DUNGEON_STYLES, type DungeonStyleId } from '../../src/app/dungeons/styleCatalog';
import { ART_DUNGEONS, ART_SPOTS, artModel, drawClose, drawWhole } from './dungeonArtSheets';
import { savePng } from './dungeonRenderHarness';
import { specimen } from './dungeonArtSpecimen';
import { mapLayout } from '../../src/app/dungeons/render/layoutSize';
import { renderMap } from '../../src/app/dungeons/render/renderMap';
import { dungeonStyle } from '../../src/app/dungeons/styleCatalog';
import { renderThumbnail } from '../../src/app/dungeons/render/thumbnail';

/** The dungeon the gallery's cards are judged on. */
const CARD_DUNGEON = 'crumbling';

/**
 * Every look on dungeons of every kind, whole and close up at 200 px per cell with tokens, written
 * to `out/dungeon-render/v2-art/` for judging by eye. `VITE_ART_LOOK`, `VITE_ART_DUNGEON` and
 * `VITE_ART_SHOT` (whole, close, mono) narrow a run while iterating.
 */

const only = (key: string): string[] | null => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value ? value.split(',') : null;
};
const looks = only('VITE_ART_LOOK');
const dungeons = only('VITE_ART_DUNGEON');
const shots = only('VITE_ART_SHOT') ?? ['whole', 'close'];

describe('dungeon looks, for judging by eye', () => {
  for (const { id } of DUNGEON_STYLES) {
    if (looks && !looks.includes(id)) continue;
    for (const { name } of ART_DUNGEONS) {
      if (dungeons && !dungeons.includes(name)) continue;
      it(`${id} ${name}`, async () => {
        const model = artModel(name);
        const views: [string, DungeonView][] = [['', DEFAULT_VIEW]];
        if (shots.includes('mono')) views.push(['-mono', { ...DEFAULT_VIEW, monochrome: true }]);
        for (const [suffix, view] of views) {
          for (let floor = 0; floor < model.floors.length; floor++) {
            const f = model.floors.length > 1 ? `-f${floor}` : '';
            if (shots.includes('whole')) await savePng(drawWhole(model, id as DungeonStyleId, view, floor), `v2-art/${id}-${name}${f}${suffix}`);
            if (shots.includes('close')) await savePng(drawClose(model, id as DungeonStyleId, view, floor), `v2-art/${id}-${name}${f}${suffix}-close`);
          }
        }
      });
    }
    if (shots.includes('card')) {
      it(`${id} card`, async () => {
        // A style card as the gallery draws it: 104 × 78 points at a device pixel ratio of 2.
        const canvas = new OffscreenCanvas(208, 156);
        renderThumbnail(canvas.getContext('2d')!, artModel(CARD_DUNGEON), dungeonStyle(id), DEFAULT_VIEW, { width: 208, height: 156, legibleAt: 2 });
        await savePng(canvas, `v2-art/card-${id}`);
      });
    }
    if (shots.includes('specimen')) {
      it(`${id} specimen`, async () => {
        const model = specimen();
        const layout = mapLayout(model, 120, DEFAULT_VIEW);
        for (const [floor, openings] of [[0, 'cut'], [0, 'drawn'], [1, 'cut']] as const) {
          const canvas = new OffscreenCanvas(layout.widthPx, layout.heightPx);
          renderMap(canvas.getContext('2d')!, model, dungeonStyle(id), DEFAULT_VIEW, { pxPerCell: 120, floor, openings });
          await savePng(canvas, `v2-art/specimen-${id}-f${floor}-${openings}`);
        }
      });
    }
    if (shots.includes('spots')) {
      it(`${id} terrain spots`, async () => {
        for (const spot of ART_SPOTS) {
          const canvas = drawClose(artModel(spot.dungeon), id as DungeonStyleId, DEFAULT_VIEW, spot.floor, spot.cells ?? 10, spot.rows ?? 7, false, spot.centre);
          await savePng(canvas, `v2-art/spot-${id}-${spot.name}`);
        }
      });
    }
  }
});

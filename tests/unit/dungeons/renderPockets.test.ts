import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import { inPocket, narrowPockets } from '../../../src/app/dungeons/render/pockets';
import { visibleDungeon } from '../../../src/app/dungeons/render/visibleDungeon';
import { DEFAULT_VIEW } from '../../../src/app/dungeons/style';
import { dungeonText } from '../../../src/app/dungeons/text/dungeonText';
import { addDoor, addRoom, emptyModel } from '../../fixtures/dungeonModelBuilder';

describe('rock the rooms close in on', () => {
  // The dungeon whose page showed a ragged island of paper between rotunda 3 and the rooms around it.
  const dungeon = visibleDungeon(generateDungeon({ seed: 458782179, tags: [] }, dungeonText), DEFAULT_VIEW);
  const pockets = narrowPockets(dungeon, 0.5);

  it('finds the pocket beside the rotunda, where the band did not reach', () => {
    // Farther than the hatching distance from every floor, yet walled in on all sides.
    expect(dungeon.field.distance(13.6, -1.4)).toBeGreaterThan(0.5);
    expect(inPocket(pockets, 13.6, -1.4)).toBe(true);
    // The strip between the two rooms above, which the same rock runs into.
    expect(inPocket(pockets, 12.5, -3.5)).toBe(true);
  });

  it('never counts a floor or the open ground outside as a pocket', () => {
    const { bounds } = dungeon;
    for (let y = bounds.minY - 2; y < bounds.maxY + 2; y += 0.25) {
      for (let x = bounds.minX - 2; x < bounds.maxX + 2; x += 0.25) {
        if (inPocket(pockets, x, y)) expect(dungeon.field.distance(x, y), `${x},${y}`).toBeGreaterThan(-0.05);
      }
    }
    expect(inPocket(pockets, bounds.minX - 1, bounds.minY - 1)).toBe(false);
  });

  it('leaves a courtyard wider than the band open ground', () => {
    const model = emptyModel(1, 'Ring', '');
    // Four halls around a 4 × 4 yard, joined at the corners by single cells.
    addRoom(model, { x: 0, y: 0, w: 6, h: 1 });
    addRoom(model, { x: 0, y: 5, w: 6, h: 1 });
    addRoom(model, { x: 0, y: 1, w: 1, h: 4 });
    addRoom(model, { x: 5, y: 1, w: 1, h: 4 });
    addDoor(model, -1, 0, { x: 1, y: 0 }, 'entrance', null, 0);
    const ring = visibleDungeon(model, DEFAULT_VIEW);
    expect(narrowPockets(ring, 0.5)).toEqual([]);
    expect(narrowPockets(ring, 1.5)).toHaveLength(1);
  });
});

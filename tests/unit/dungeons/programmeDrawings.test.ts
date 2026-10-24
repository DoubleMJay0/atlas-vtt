import { describe, expect, it } from 'vitest';
import { DRAWN_PROP_KINDS, DRAWN_TERRAIN_KINDS } from '../../../src/app/dungeons/drawnKinds';
import { ALL_PROP_KINDS, type PropKind } from '../../../src/app/dungeons/props/propKinds';
import { ALL_TERRAIN_KINDS } from '../../../src/app/dungeons/terrain/catalog';
import awaiting from './awaitingDrawings.json';

/**
 * What still waits for its drawing (`awaitingDrawings.json`), kept exact both ways: `npm run
 * preflight` fails while any list is not empty, so nothing ships with a room or a terrain kind
 * that has no art.
 */
describe('drawings still awaited', () => {
  it('lists in awaitingDrawings.json no kind that has a drawing', () => {
    for (const kind of awaiting.props) {
      expect(ALL_PROP_KINDS.has(kind as PropKind), kind).toBe(true);
      expect(DRAWN_PROP_KINDS.has(kind as PropKind), kind).toBe(false);
    }
    expect([...awaiting.terrain].sort()).toEqual([...ALL_TERRAIN_KINDS].filter((kind) => !DRAWN_TERRAIN_KINDS.has(kind)).sort());
  });
});

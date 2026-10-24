import { describe, expect, it } from 'vitest';
import { DRAWN_PROP_KINDS, DRAWN_TERRAIN_KINDS } from '../../../src/app/dungeons/drawnKinds';
import { ALL_PROP_KINDS, type PropKind } from '../../../src/app/dungeons/props/propKinds';
import { ALL_TERRAIN_KINDS } from '../../../src/app/dungeons/terrain/catalog';
import { THEMES, programmeOf } from '../../../src/app/dungeons/themes/themes';
import type { RoomProgramme } from '../../../src/app/dungeons/themes/themeTypes';
import { generateDungeon } from '../../../src/app/dungeons/generate';
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

  it('names every programme kind without a drawing in awaitingDrawings.json', () => {
    const programmes = Object.values(THEMES).flatMap((theme) => {
      const programme = programmeOf(theme, new Set());
      return programme ? [programme] : [];
    });
    const kinds = new Set(programmes.flatMap(kindsOf));
    expect([...awaiting.props].sort()).toEqual([...kinds].filter((kind) => !DRAWN_PROP_KINDS.has(kind)).sort());
  });
});

describe('generated dungeons', () => {
  it('hold no prop or terrain kind without a drawing', () => {
    const undrawn = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const theme of ['fortress', 'mansion', 'cavern'] as const) {
        const model = generateDungeon({ seed: seed * 37, theme, tags: seed % 3 ? [] : ['ruined', 'large'], floors: 1 + (seed % 3) });
        for (const floor of model.floors) {
          for (const prop of floor.props) if (!DRAWN_PROP_KINDS.has(prop.kind)) undrawn.add(prop.kind);
          for (const piece of floor.terrain) if (!DRAWN_TERRAIN_KINDS.has(piece.kind)) undrawn.add(piece.kind);
        }
      }
    }
    expect([...undrawn]).toEqual([]);
  }, 120_000);
});

/** Every kind a programme may place: its pieces, the pieces they stand around, and its arenas' seats. */
function kindsOf(programme: RoomProgramme): PropKind[] {
  const pieces = programme.rooms.flatMap(({ furnish }) => [furnish.defining, furnish.with, ...furnish.pieces]);
  return [
    ...pieces.flatMap((piece) => (piece ? [piece.kind, ...(piece.parent ? [piece.parent] : [])] : [])),
    ...programme.climax.flatMap(({ arena }) => (arena.seat ? [arena.seat] : [])),
  ];
}

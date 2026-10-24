import { describe, expect, it } from 'vitest';
import { PROP_SPECS } from '../../../src/app/dungeons/props/catalogue';
import { FEATURES } from '../../../src/app/dungeons/themes/features';
import { ALL_PROP_KINDS, type PropKind } from '../../../src/app/dungeons/props/propKinds';
import { FORTRESS } from '../../../src/app/dungeons/themes/fortress';
import { MANSION } from '../../../src/app/dungeons/themes/mansion';
import type { Piece, RoomProgramme, RoomTypeSpec } from '../../../src/app/dungeons/themes/themeTypes';

/** Rooms that are furnished as what they are, so they never take a hazard. */
const FORMAL = ['throne-room', 'chapel', 'solar', 'chamber', 'library', 'kitchen', 'great-hall', 'dining-room', 'bedroom', 'master-bedroom', 'drawing-room'];
/** Hazard types whose furniture stands only where the hazard was not placed. */
const FURNISHED_WITHOUT_HAZARD = ['cistern', 'gaol'];

const PROGRAMMES: [string, RoomProgramme, readonly (readonly [string, string])[]][] = [
  ['fortress', FORTRESS, [['kitchen', 'chapel'], ['kitchen', 'solar'], ['gaol', 'solar'], ['garderobe', 'kitchen']]],
  ['mansion', MANSION, [['kitchen', 'drawing-room'], ['kitchen', 'master-bedroom']]],
];

function piecesOf(spec: RoomTypeSpec): Piece[] {
  const { defining, with: belonging, pieces } = spec.furnish;
  return [...(defining ? [defining] : []), ...(belonging ? [belonging] : []), ...pieces];
}

function kindsOf(programme: RoomProgramme): PropKind[] {
  const seats = programme.climax.flatMap((c) => (c.arena.seat ? [c.arena.seat] : []));
  return [...programme.rooms.flatMap((spec) => piecesOf(spec).flatMap((p) => [p.kind, ...(p.parent ? [p.parent] : [])])), ...seats];
}

describe.each(PROGRAMMES)('the %s programme', (_, programme, apartPairs) => {
  const ids = new Set(programme.rooms.map((spec) => spec.id));
  const spec = (id: string): RoomTypeSpec | undefined => programme.rooms.find((s) => s.id === id);

  it('names only its own room types', () => {
    const named = [
      ...programme.entrance.map(([id]) => id),
      ...programme.pivot,
      programme.stairs,
      ...programme.climax.map((c) => c.type),
      ...programme.clusters.flatMap((c) => [c.core, ...c.members]),
      ...Object.values(programme.stages).flat(),
      ...programme.filler.map(([id]) => id),
      ...programme.rooms.flatMap((s) => [...(s.next ?? []), ...(s.near ?? []), ...(s.apart ?? [])]),
    ];
    expect(named.filter((id) => !ids.has(id))).toEqual([]);
    expect(ids.size).toBe(programme.rooms.length);
  });

  it('counts sensibly', () => {
    for (const s of programme.rooms) {
      expect(s.count[0], s.id).toBeGreaterThanOrEqual(0);
      expect(s.count[0], s.id).toBeLessThanOrEqual(s.count[1]);
      if (s.required) expect(s.count[0], s.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('weighs its climax', () => {
    for (const c of programme.climax) expect(c.weight, c.type).toBeGreaterThan(0);
    expect(Math.abs(programme.climax.reduce((sum, c) => sum + c.weight, 0) - 1)).toBeLessThan(1e-9);
  });

  it('keeps hazards and furniture apart', () => {
    for (const s of programme.rooms) {
      const defining = s.furnish.defining;
      if (s.terrain.hazards?.length && defining && !FURNISHED_WITHOUT_HAZARD.includes(s.id)) expect(PROP_SPECS[defining.kind].natural, s.id).toBe(true);
    }
    for (const id of FORMAL) expect(spec(id)?.terrain.hazards ?? [], id).toEqual([]);
  });

  it('gives every hole, hazard and standing water a reason of its type', () => {
    for (const s of programme.rooms) {
      const reasons = (s.terrain.features ?? []).map((reason) => FEATURES[reason]);
      const kinds = new Set(reasons.flatMap((reason) => reason.kinds));
      for (const kind of [...(s.terrain.hazards ?? []), ...(s.terrain.holes ?? [])]) expect(kinds.has(kind), `${s.id}: ${kind}`).toBe(true);
      if (s.terrain.water) expect(reasons.some((reason) => reason.water === s.terrain.water), `${s.id}: ${s.terrain.water}`).toBe(true);
    }
  });

  it('uses only catalogue kinds', () => {
    expect(kindsOf(programme).filter((kind) => !ALL_PROP_KINDS.has(kind))).toEqual([]);
  });

  it('lists the never-adjacent pairs both ways', () => {
    for (const [a, b] of apartPairs) {
      expect(spec(a)?.apart ?? [], `${a} apart from ${b}`).toContain(b);
      expect(spec(b)?.apart ?? [], `${b} apart from ${a}`).toContain(a);
    }
  });
});

describe('thrones', () => {
  it('puts the throne in the Fortress alone', () => {
    for (const [name, programme] of PROGRAMMES) if (name !== 'fortress') expect(kindsOf(programme)).not.toContain('throne');
    expect(kindsOf(FORTRESS)).toContain('throne');
  });
});

describe('the Haunted Mansion programme', () => {
  it('refuses every hazard but the rotted floor of a ruin', () => {
    expect(MANSION.rooms.filter((spec) => spec.terrain.hazards?.length).map((spec) => spec.id)).toEqual(['collapsed-room']);
    expect(MANSION.rooms.find((spec) => spec.id === 'collapsed-room')?.ruinedOnly).toBe(true);
  });

  it('offers the ballroom as climax only on the entrance floor', () => {
    expect(MANSION.climax.find((c) => c.type === 'ballroom')?.onlyOnEntranceFloor).toBe(true);
  });
});

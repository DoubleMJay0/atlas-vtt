import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import type { DoorKind, DungeonDoor, DungeonModel } from '../../../src/app/dungeons/model';
import { mapLayout } from '../../../src/app/dungeons/render/layoutSize';
import { dungeonWalls, wallInkWidth, type DungeonPlacement } from '../../../src/app/dungeons/scene/toWalls';
import { DEFAULT_VIEW, STYLE_PRESETS } from '../../../src/app/dungeons/style';
import { dungeonText } from '../../../src/app/dungeons/text/dungeonText';
import type { WallSegment } from '../../../src/app/types/wallTypes';
import { smallDungeon } from '../../fixtures/dungeonModels';
import { duplicateWalls, escapingRays, farReach, looseEnds, overlappingWalls, toWorld, wallsCrossed } from './wallChecks';

const STYLE = STYLE_PRESETS.parchment;
const OPENINGS: readonly DoorKind[] = ['open', 'doorway', 'entrance', 'stairs-down', 'steps', 'portcullis'];

const placementOf = (model: DungeonModel, pxPerCell = 100): DungeonPlacement => {
  const { originCell } = mapLayout(model, pxPerCell, DEFAULT_VIEW);
  return { originCell, pxPerCell };
};

function wallsOf(model: DungeonModel, placement = placementOf(model)): WallSegment[] {
  return Object.values(dungeonWalls(model, STYLE, DEFAULT_VIEW, placement).walls);
}

/** A way along the door's direction through its cell: from inside the room before it to inside the one after it. */
function wayThrough(door: DungeonDoor, placement: DungeonPlacement): [{ x: number; y: number }, { x: number; y: number }] {
  const c = { x: door.x + 0.5, y: door.y + 0.5 };
  const back = door.from === null ? 0 : 1;
  const ahead = door.to === null ? 0 : 1;
  return [
    toWorld({ x: c.x - door.dir.x * back, y: c.y - door.dir.y * back }, placement),
    toWorld({ x: c.x + door.dir.x * ahead, y: c.y + door.dir.y * ahead }, placement),
  ];
}

function checkSealed(model: DungeonModel): void {
  const placement = placementOf(model);
  const walls = wallsOf(model, placement);
  const far = farReach(model, placement);
  for (const room of model.rooms) expect(escapingRays(walls, room, placement, far), `room ${room.id} of seed ${model.seed}`).toEqual([]);
  expect(looseEnds(walls)).toEqual([]);
  expect(duplicateWalls(walls)).toBe(0);
}

describe('dungeon walls', () => {
  it('encloses every room, with no wall end left loose and no wall drawn twice', () => {
    const model = smallDungeon();
    checkSealed(model);
    expect(overlappingWalls(wallsOf(model))).toBe(0);
  });

  it('turns each door kind into a door, a locked door, a secret door or an opening', () => {
    const model = smallDungeon();
    const result = dungeonWalls(model, STYLE, DEFAULT_VIEW, placementOf(model));
    const walls = Object.values(result.walls);
    const doors = walls.filter(w => w.type === 'door');
    expect(result.unplaced).toBe(0);
    expect(result.doors).toEqual({ door: 2, gate: 1, barricade: 1, secret: 1 });
    expect(doors.filter(w => w.locked)).toHaveLength(2);
    expect(doors.every(w => w.closed === true)).toBe(true);
    expect(walls.filter(w => w.type === 'secret-door')).toEqual([expect.objectContaining({ closed: true })]);
    expect(walls.filter(w => w.chainId === undefined)).toHaveLength(5);
  });

  it('leaves the way through an opening free and puts exactly one door across a closed one', () => {
    const model = smallDungeon();
    const placement = placementOf(model);
    const walls = wallsOf(model, placement);
    for (const door of model.doors) {
      const [a, b] = wayThrough(door, placement);
      const crossed = wallsCrossed(walls, a, b);
      if (OPENINGS.includes(door.kind)) expect(crossed, door.kind).toEqual([]);
      else expect(crossed.map(w => w.type), door.kind).toEqual([door.kind === 'secret' ? 'secret-door' : 'door']);
    }
  });

  it('spans a door across its cell between the centre lines of the walls beside it', () => {
    const model = smallDungeon();
    const placement = placementOf(model);
    const half = (wallInkWidth(STYLE) / 2) * placement.pxPerCell;
    const door = Object.values(dungeonWalls(model, STYLE, DEFAULT_VIEW, placement).walls).find(w => w.type === 'door' && !w.locked)!;
    const length = Math.hypot(door.p2.x - door.p1.x, door.p2.y - door.p1.y);
    expect(length).toBeCloseTo(placement.pxPerCell + 2 * half, 0);
  });

  it('gives a secret wing no walls when the view hides it', () => {
    const model = smallDungeon();
    const placement = placementOf(model);
    const hidden = Object.values(dungeonWalls(model, STYLE, { secrets: false }, placement).walls);
    expect(hidden.some(w => w.type === 'secret-door')).toBe(false);
    expect(hidden.length).toBeLessThan(wallsOf(model, placement).length);
  });

  it('is the same for the same dungeon', () => {
    const model = smallDungeon();
    expect(dungeonWalls(model, STYLE, DEFAULT_VIEW, placementOf(model))).toEqual(dungeonWalls(model, STYLE, DEFAULT_VIEW, placementOf(model)));
  });

  it('seals generated dungeons of every shape', () => {
    const combos: string[][] = [[], ['round', 'secret', 'multi-level'], ['chaotic', 'winding', 'large'], ['ordered', 'temple', 'colonnades', 'backdoor']];
    for (let seed = 1; seed <= 24; seed++) {
      const model = generateDungeon({ seed, tags: combos[seed % combos.length]! }, dungeonText);
      checkSealed(model);
      const { doors, unplaced } = dungeonWalls(model, STYLE, DEFAULT_VIEW, placementOf(model));
      const closing = model.doors.filter(d => !OPENINGS.includes(d.kind)).length;
      expect(unplaced, `seed ${seed}`).toBe(0);
      expect(Object.values(doors).reduce((sum, n) => sum + n, 0)).toBe(closing);
    }
  });
});

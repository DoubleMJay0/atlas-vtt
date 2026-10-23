import { describe, expect, it } from 'vitest';
import { generateDungeon } from '../../../src/app/dungeons/generate';
import type { DoorKind, DungeonDoor, DungeonModel } from '../../../src/app/dungeons/model';
import { mapLayout } from '../../../src/app/dungeons/render/layoutSize';
import { dungeonWalls, wallInkWidth, type DungeonPlacement } from '../../../src/app/dungeons/scene/toWalls';
import { DEFAULT_VIEW } from '../../../src/app/dungeons/style';
import { dungeonStyle } from '../../../src/app/dungeons/styleCatalog';
import type { WallSegment } from '../../../src/app/types/wallTypes';
import { smallDungeon } from '../../fixtures/dungeonModels';
import { duplicateWalls, escapingRays, farReach, looseEnds, overlappingWalls, toWorld, wallsCrossed } from './wallChecks';

const STYLE = dungeonStyle('parchment');
const OPENINGS: readonly DoorKind[] = ['opening', 'steps'];

const placementOf = (model: DungeonModel, pxPerCell = 100): DungeonPlacement => {
  const { originCell } = mapLayout(model, pxPerCell, DEFAULT_VIEW);
  return { originCell, pxPerCell };
};

function wallsOf(model: DungeonModel, placement = placementOf(model), floor = 0): WallSegment[] {
  return Object.values(dungeonWalls(model, STYLE, DEFAULT_VIEW, placement, floor).walls);
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

/** Walls across every entrance's open mouth, where the outline of its cell would close it, so a check can find the rest sealed. */
function mouthsClosed(model: DungeonModel, floor: number, placement: DungeonPlacement): WallSegment[] {
  const half = wallInkWidth(STYLE) / 2;
  const snap = (v: number): number => Math.round(v * 1024) / 1024;
  return model.floors[floor]!.doors.filter(door => door.from === null).map((door, k): WallSegment => {
    const out = 0.5 + half;
    const at = (u: number): { x: number; y: number } =>
      toWorld({ x: snap(door.x + 0.5 - door.dir.x * out - door.dir.y * u), y: snap(door.y + 0.5 - door.dir.y * out + door.dir.x * u) }, placement);
    return { id: `mouth_${k}`, kind: 'wall', type: 'solid', p1: at(-out), p2: at(out) };
  });
}

function checkSealed(model: DungeonModel): void {
  const placement = placementOf(model);
  const far = farReach(model, placement);
  model.floors.forEach((floor, index) => {
    const walls = [...wallsOf(model, placement, index), ...mouthsClosed(model, index, placement)];
    for (const room of floor.rooms) expect(escapingRays(walls, room, placement, far), `room ${room.id} of floor ${index}, seed ${model.seed}`).toEqual([]);
    expect(looseEnds(walls)).toEqual([]);
    expect(duplicateWalls(walls)).toBe(0);
  });
}

describe('dungeon walls', () => {
  it('encloses every room, with no wall end left loose and no wall drawn twice', () => {
    const model = smallDungeon();
    checkSealed(model);
    expect(overlappingWalls(wallsOf(model))).toBe(0);
  });

  it('turns each door kind into a door, a secret door or an opening', () => {
    const model = smallDungeon();
    const result = dungeonWalls(model, STYLE, DEFAULT_VIEW, placementOf(model));
    const walls = Object.values(result.walls);
    const doors = walls.filter(w => w.type === 'door');
    expect(result.unplaced).toBe(0);
    expect(result.doors).toEqual({ door: 5, secret: 1 });
    expect(doors.some(w => w.locked)).toBe(false);
    expect(doors.every(w => w.closed === true)).toBe(true);
    expect(walls.filter(w => w.type === 'secret-door')).toEqual([expect.objectContaining({ closed: true })]);
    expect(walls.filter(w => w.chainId === undefined)).toHaveLength(6);
  });

  it('leaves every entrance open to the outside', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const model = generateDungeon({ seed, tags: [], floors: 1 });
      const placement = placementOf(model);
      const walls = wallsOf(model, placement);
      for (const door of model.floors[0]!.doors.filter(d => d.from === null && d.kind === 'opening')) {
        const inside = toWorld({ x: door.x + 0.5 + door.dir.x, y: door.y + 0.5 + door.dir.y }, placement);
        const outside = toWorld({ x: door.x + 0.5 - door.dir.x * 3, y: door.y + 0.5 - door.dir.y * 3 }, placement);
        expect(wallsCrossed(walls, inside, outside), `seed ${seed}`).toEqual([]);
      }
    }
  });

  it('leaves the way through an opening free and puts exactly one door across a closed one', () => {
    const model = smallDungeon();
    const placement = placementOf(model);
    const walls = wallsOf(model, placement);
    for (const door of model.floors[0]!.doors) {
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
    const door = Object.values(dungeonWalls(model, STYLE, DEFAULT_VIEW, placement).walls).find(w => w.type === 'door')!;
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
    const combos: string[][] = [[], ['round', 'secret'], ['chaotic', 'winding', 'large'], ['ordered', 'temple', 'colonnades']];
    for (let seed = 1; seed <= 24; seed++) {
      const model = generateDungeon({ seed, tags: combos[seed % combos.length]!, floors: 1 + (seed % 3) });
      checkSealed(model);
      model.floors.forEach((floor, index) => {
        const { doors, unplaced } = dungeonWalls(model, STYLE, DEFAULT_VIEW, placementOf(model), index);
        const closing = floor.doors.filter(d => !OPENINGS.includes(d.kind)).length;
        expect(unplaced, `seed ${seed}`).toBe(0);
        expect(Object.values(doors).reduce((sum, n) => sum + n, 0)).toBe(closing);
      });
    }
  });
});

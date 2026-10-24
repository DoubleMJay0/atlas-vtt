import { holdsCell } from '../../../src/app/dungeons/geometry';
import { caveSites } from '../../../src/app/dungeons/layout/cavern/caveSites';
import type { DungeonFloor, DungeonModel } from '../../../src/app/dungeons/model';
import { PROP_SPECS } from '../../../src/app/dungeons/props/catalogue';
import { neighbours } from '../../../src/app/dungeons/roomGraph';

/**
 * The believability rules of a Cavern, recomputed from the finished model (the spec's "Every
 * feature has a reason"): what each room type, hazard and liquid needs of the cave around it.
 */

/** Rule 8: a roost lies within a hop of the mouth, a fungus grove within a hop of water or a roost, the den deep. */
export function lifeProblems(model: DungeonModel): string[] {
  const sites = caveSites(model.floors);
  return model.floors.flatMap((floor, f) => {
    const site = sites[f]!;
    const near = neighbours(floor.rooms.length, floor.doors);
    return floor.rooms.flatMap((room) => {
      if (room.type === 'roost' && (site.hopsFromMouth[room.id] ?? Infinity) > 1) return [`floor ${f}: a roost ${site.hopsFromMouth[room.id]} hops from the mouth`];
      if (room.type === 'fungus-grove' && !site.nearWater(room.id, 1) && !(near[room.id] ?? []).some((n) => floor.rooms[n]?.type === 'roost')) return [`floor ${f}: a fungus grove far from water and roosts`];
      if (room.type === 'den' && !site.deep(room.id)) return [`floor ${f}: a den that is not deep`];
      return [];
    });
  });
}

/** A room that takes a hazard holds no furniture but what nature made in it. */
export function hazardFurnishProblems(floor: DungeonFloor): string[] {
  const hazarded = new Set(floor.terrain.filter((p) => p.traits.hazard).map((p) => p.room));
  return floor.props.filter((p) => hazarded.has(p.room) && !PROP_SPECS[p.kind].natural).map((p) => `a ${p.kind} in hazard room ${p.room}`);
}

type Liquid = 'water' | 'lava' | 'acid';

const LIQUID_OF: Readonly<Partial<Record<string, Liquid>>> = { 'deep-water': 'water', lava: 'lava', acid: 'acid' };

/** At most one liquid in a room: water, lava or acid. */
export function liquidProblems(floor: DungeonFloor): string[] {
  return floor.rooms.flatMap((room) => {
    const liquids = new Set<Liquid>();
    for (const piece of floor.terrain.filter((p) => p.room === room.id)) {
      const liquid = piece.kind === 'shallow-water' || piece.kind === 'pool' ? 'water' : LIQUID_OF[piece.traits.hazard ?? ''];
      if (liquid) liquids.add(liquid);
    }
    if (floor.waterCells.some((c) => holdsCell(room, c.x, c.y))) liquids.add('water');
    return liquids.size > 1 ? [`room ${room.id} holds ${[...liquids].join(' and ')}`] : [];
  });
}

import type { DungeonFloor, DungeonProp } from '../../model';
import type { PropKind } from '../../props/propKinds';
import type { DungeonTerrain, TerrainKind } from '../../terrainModel';
import { forestRivers } from '../../forest/forestRivers';
import { riverField } from '../../forest/riverShape';

/** What a clearing may hold of what the Cavern placed: what grows or lies in a wood, a camp's fire. */
const FOREST_PROPS: ReadonlySet<PropKind> = new Set<PropKind>(['campfire', 'mushrooms', 'boulder']);
/** Terrain a wood has as well: water, undergrowth, boulders and the ways down to the caves. */
const FOREST_TERRAIN: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  'shallow-water', 'deep-water', 'channel', 'pool', 'brambles', 'thicket', 'tangled-roots', 'chasm-floor', 'shaft', 'bridge',
]);
/** A clearing holds at most this many boulders: a few as cover, never a scree. */
const MOST_BOULDERS = 2;
/** Nothing stands nearer a river's water than this, in cells. */
const RIVER_CLEAR = 0.8;

/**
 * A Forest's entry floor from the cave floor its layout made: the same shape, exits, water, stairs
 * and holes down (a sinkhole to the caves below), so the scene's walls, ways and levels stand as a
 * cave's; without what only a cave holds (calcite, crusts, carved rock, columns, cracks, climbers).
 */
export function forestFloor(floor: DungeonFloor, seed: number, tags: ReadonlySet<string>): DungeonFloor {
  const rivers = forestRivers(floor, seed, tags);
  const field = riverField(rivers);
  return {
    ...floor,
    forest: true,
    ...(rivers.length > 0 && { rivers }),
    // A wood's ground is level: a cave's steps between chambers are open ground.
    doors: floor.doors.map((door) => (door.kind === 'steps' ? { ...door, kind: 'opening' as const } : door)),
    props: fewBoulders(floor.props.filter((prop) => FOREST_PROPS.has(prop.kind) && field.distance(prop.x, prop.y) > RIVER_CLEAR)),
    terrain: renumbered(floor.terrain.filter((piece) => piece.opening !== undefined || FOREST_TERRAIN.has(piece.kind))),
    columns: [],
    rubble: [],
    cracks: [],
    growth: [],
  };
}

/** Every prop but boulders, and of a clearing's boulders the first `MOST_BOULDERS`. */
function fewBoulders(props: readonly DungeonProp[]): DungeonProp[] {
  const kept = new Map<number, number>();
  return props.filter((prop) => {
    if (prop.kind !== 'boulder') return true;
    const count = kept.get(prop.room) ?? 0;
    kept.set(prop.room, count + 1);
    return count < MOST_BOULDERS;
  });
}

/** Pieces kept, each `id` its new place in the list, and a bridge's `spans` the new id of what it crosses (none where that went). */
function renumbered(kept: readonly DungeonTerrain[]): DungeonTerrain[] {
  const ids = new Map(kept.map((piece, index) => [piece.id, index]));
  return kept.map((piece, index) => {
    const { spans, ...rest } = piece;
    const crossed = spans === undefined ? undefined : ids.get(spans);
    return { ...rest, id: index, ...(crossed !== undefined && { spans: crossed }) };
  });
}

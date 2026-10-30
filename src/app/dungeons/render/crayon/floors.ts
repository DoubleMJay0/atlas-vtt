import type { DungeonRoom } from '../../model';
import type { RoomTypeId } from '../../themes/roomTypes';
import { viewBounds, type ArtScene } from '../art/artScene';
import { floorStones } from '../art/floorStones';
import { hash2 } from '../art/noise';
import { clipFloors, traceRings } from '../art/outline';
import { polyPath, polysPath, runsPath, type PathFn } from '../art/paths';
import { engravedWayOut, groundsOf, wayGroundRing } from '../cave/mouth/wayOutGround';
import { engravedFractures } from '../cave/ground/floor';
import { drawFloorJoints } from '../engraved/floor';
import type { Pens } from '../engraved/pens';
import { shapeBounds, traceShapes, type FloorShape } from '../geometry';
import { withAlpha } from '../palette';
import { boardPlanks, boardSeams, boardsRunAlongX } from './boards';
import type { CrayonBox } from './crayonBox';
import { CRAYON_GROUNDS, colourGround, fadedFields, groundFields } from './ground';

/**
 * Crayon's floors, every one coloured in as the forest's clearings are (`ground.ts`), each in its
 * own material: a built floor's flagstones in grey stone with its joints pencilled and some stones
 * a shade darker, a stable's packed earth, a house's boards in wood with their seams (its kitchen,
 * scullery, bathroom and cellar flagged in stone), and a cave's bare rock with its faults.
 */

type FloorMaterial = 'stone' | 'earth' | 'boards';

/** Rooms of a house laid with flagstones, where water is used or things are stored cool; the rest are boarded. */
const FLAGGED_IN_A_HOUSE: ReadonlySet<RoomTypeId> = new Set(['kitchen', 'scullery', 'laundry', 'bathroom', 'servery', 'wine-cellar', 'conservatory', 'buttery', 'storeroom']);
/** Rooms of a built floor whose floor is packed earth. */
const EARTHEN: ReadonlySet<RoomTypeId> = new Set(['stable', 'gaol']);

/** How much darker a darker flagstone or board is: one light coat of its own. */
const SHADE = { cover: 0.22, passes: 1 } as const;
/** The share of stones and boards a shade darker. */
const SHADED = 0.38;

/** A house's cellar floors are flagged throughout: they lie below its entrance floor. */
function isCellar(scene: ArtScene): boolean {
  const { model, index } = scene.env.dungeon;
  return index >= model.floors.length - (model.below ?? 0);
}

function materialOf(room: DungeonRoom, house: boolean, cellar: boolean): FloorMaterial {
  const type = room.type;
  if (house) return cellar || (type !== undefined && FLAGGED_IN_A_HOUSE.has(type)) ? 'stone' : 'boards';
  return type !== undefined && EARTHEN.has(type) ? 'earth' : 'stone';
}

/** The floor's shapes by material; door cells and doorways take what the floor is mostly laid with. */
function floorsByMaterial(scene: ArtScene): Map<FloorMaterial, FloorShape[]> {
  const { dungeon } = scene.env;
  const house = dungeon.house !== undefined;
  const cellar = house && isCellar(scene);
  const byShape = new Map<FloorShape, FloorMaterial>();
  for (const room of dungeon.rooms) {
    const shape = dungeon.roomShapes.get(room.id);
    if (shape) byShape.set(shape, materialOf(room, house, cellar));
  }
  const between: FloorMaterial = house && !cellar ? 'boards' : 'stone';
  const out = new Map<FloorMaterial, FloorShape[]>();
  for (const shape of scene.floors) {
    const material = byShape.get(shape) ?? between;
    const list = out.get(material);
    if (list) list.push(shape);
    else out.set(material, [shape]);
  }
  return out;
}

/** A built floor or a house's: the vellum, each material's ground and its joints or seams. */
export function crayonFloor(scene: ArtScene, pens: Pens, box: CrayonBox): void {
  box.paper((path) => traceShapes(path, scene.floors));
  const fields = groundFields(scene.env.dungeon.model.seed);
  const b = viewBounds(scene.frame, 1);
  for (const [material, shapes] of floorsByMaterial(scene)) {
    if (material === 'boards') drawBoards(scene, pens, box, shapes, fields, b);
    else {
      colourGround(box, (path) => traceShapes(path, shapes), CRAYON_GROUNDS[material], fields, b);
      if (material === 'stone') shadeFlagstones(scene, pens, box, shapes, b);
    }
  }
}

/** Some flagstones a shade darker, so the floor reads as stones laid side by side; then the joints. */
function shadeFlagstones(scene: ArtScene, pens: Pens, box: CrayonBox, shapes: readonly FloorShape[], b: ReturnType<typeof viewBounds>): void {
  const { ctx, dungeon, style } = scene.env;
  const stones = floorStones(style.floor, b, dungeon.model.seed, (x, y) => dungeon.field.distance(x, y) < 0.9).filter((stone) => stone.tone < SHADED);
  if (stones.length) {
    ctx.save();
    clip(scene, shapes);
    box.colourIn(polysPath(stones.map((stone) => stone.poly)), { colour: CRAYON_GROUNDS.stone[0].colour, ...SHADE }, undefined, b);
    ctx.restore();
  }
  drawFloorJoints(scene, pens, shapes);
}

/** Boards along each room's longer side, coloured along their grain, some a shade darker, their seams pencilled. */
function drawBoards(scene: ArtScene, pens: Pens, box: CrayonBox, shapes: readonly FloorShape[], fields: ReturnType<typeof groundFields>, b: ReturnType<typeof viewBounds>): void {
  const { ctx, dungeon } = scene.env;
  const seed = dungeon.model.seed;
  for (const alongX of [true, false]) {
    const laid = shapes.filter((shape) => boardsRunAlongX(shapeBounds(shape)) === alongX);
    if (!laid.length) continue;
    const planks = laid.flatMap((shape) => boardPlanks(shapeBounds(shape), alongX, seed));
    // Nearly along the grain, a little off as a hand lays it.
    const grain = (alongX ? 0 : Math.PI / 2) + (hash2(seed, alongX ? 1 : 2, 0x60a2) - 0.5) * 0.12;
    colourGround(box, (path) => traceShapes(path, laid), CRAYON_GROUNDS.boards, fields, b, grain);
    ctx.save();
    clip(scene, laid);
    const darker = planks.filter((plank) => plank.tone < SHADED).map((plank) => plank.poly);
    if (darker.length) box.colourIn(polysPath(darker), { colour: CRAYON_GROUNDS.boards[1].colour, ...SHADE, angle: grain }, undefined, b);
    ctx.beginPath();
    runsPath(boardSeams(planks, alongX, seed))(ctx);
    ctx.strokeStyle = withAlpha(pens.ink, 0.2);
    ctx.lineWidth = 0.009;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

/** Clips to the floors and, within them, to `shapes`. */
function clip(scene: ArtScene, shapes: readonly FloorShape[]): void {
  const { ctx } = scene.env;
  clipFloors(scene);
  ctx.beginPath();
  traceShapes(ctx, shapes);
  ctx.clip();
}

/** The ground of a cave's ways out, Engraved's, then coloured in as its floor is, fading with it. */
export function crayonCaveMouth(scene: ArtScene, pens: Pens, box: CrayonBox): void {
  engravedWayOut(scene, pens);
  const fields = groundFields(scene.env.dungeon.model.seed);
  const b = viewBounds(scene.frame, 1);
  for (const ground of groundsOf(scene)) {
    colourGround(box, polyPath(wayGroundRing(scene, ground.way)), CRAYON_GROUNDS.cave, fadedFields(fields, (x, y) => ground.strength({ x, y })), b);
  }
}

/** A cave's floor: the vellum, bare rock coloured in, and its faults in graphite. */
export function crayonCaveFloor(scene: ArtScene, pens: Pens, box: CrayonBox): void {
  const rock: PathFn = (path) => traceRings(path, scene.floorRings);
  box.paper(rock);
  colourGround(box, rock, CRAYON_GROUNDS.cave, groundFields(scene.env.dungeon.model.seed), viewBounds(scene.frame, 1));
  engravedFractures(scene, pens);
}

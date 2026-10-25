import { stackOf, stairEnd } from '../../../floors/floorStack';
import type { StairEnd } from '../../../floors/stairSpots';
import type { CellDir } from '../../../model';
import type { Hand } from '../../art/hand';
import { hash2 } from '../../art/noise';
import { polyPath, polysPath } from '../../art/paths';
import { doorFrame, wayFrame, type WayFrame } from './narrows';
import { layGrit } from './screeGrit';
import { screeShape } from './screeShape';
import { dashes } from './shaftMouth';
import { drawHachures, drawRunnels, layRubbleShadow, layScreeForm } from './slopeShading';
import { stoneOf } from './wayColours';

/**
 * A scree slope: a tongue of loose rock spilling from a broken lip, widening and fraying downslope
 * until its stones run out onto the floor (`screeShape`). Its light follows its form, hachures under
 * the crest say how steep it falls, and its stones are sorted, grit high, boulders clumped low.
 * Where it comes up to this floor (`lower`) its crest is overhead: dashed, with no lip.
 */
function slope(hand: Hand, frame: WayFrame, end?: StairEnd): void {
  const seed = Math.floor(hash2(frame.bounds.minX, frame.bounds.minY, hand.scene.env.dungeon.model.seed) * 0x7fffffff);
  const shape = screeShape(frame, seed);
  const path = polyPath(shape.outline);
  const stone = stoneOf(hand) !== null;
  layScreeForm(hand, frame, shape, end);
  // Grit stops short of the toe, where only the stones that rolled farthest lie.
  layGrit(hand, frame, path, [0.08, 0.55], [0.45, 0.88]);
  drawRunnels(hand, frame, shape, seed);
  // Stone carries the slope's steepness in its light and runnels; ink, without tone, in its hachures.
  if (!stone) drawHachures(hand, frame, shape, 4, seed);
  const polys = shape.stones.map(s => s.poly);
  layRubbleShadow(hand, polys, 0.025);
  if (hand.pile) hand.pile(shape.stones, s => (s.r > 0.08 ? 'outline' : 'fine'));
  else {
    hand.fill(polysPath(polys), 'rock');
    // The stones read by their outline and shadow; the boulder heading each clump is modelled by the light.
    const boulder = shape.stones.reduce((a, b) => (b.r > a.r ? b : a));
    hand.solid(polyPath(boulder.poly), boulder.c, boulder.r, frame.progress(boulder.c.x, boulder.c.y));
    hand.line(polys, 'fine', true);
  }
  // Stone's fill gives the heap its edge; ink, with no fill, draws its frayed flanks.
  if (!stone) hand.line(shape.flanks, 'fine');
  if (end === 'lower') {
    hand.line(dashes(shape.crest, 0.1, 0.06), 'outline');
    return;
  }
  hand.fill(polyPath(shape.lip), 'rock');
  hand.edges(shape.lip, true);
}

export function drawScree(hand: Hand): void {
  const { dungeon } = hand.scene.env;
  for (const door of dungeon.doors) {
    if (door.kind !== 'steps') continue;
    const down = door.descends ? door.dir : { x: -door.dir.x, y: -door.dir.y } as CellDir;
    slope(hand, doorFrame(door, down));
  }
  for (const stair of dungeon.floor.stairs) {
    if (stair.way === 'scree') slope(hand, wayFrame(stair, stair.down), stairEnd(stackOf(dungeon.model), dungeon.index, stair.to));
  }
}

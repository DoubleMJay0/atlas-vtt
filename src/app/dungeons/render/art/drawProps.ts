import type { DungeonProp } from '../../model';
import { PROP_SPECS } from '../../props/catalogue';
import type { FloorField } from '../visibleDungeon';
import { glyphFit, propGlyph } from '../propShapes';
import { drawGlyph } from './glyph';
import type { Hand } from './hand';
import { clipFloors } from './outline';

/** How far off its wall a wall piece hangs (`hangPiece`): its drawing's wall line, in cells. */
const OFF_WALL = 0.1;
/** How far either way of its cell's wall the drawn wall of a cave is looked for, in cells. */
const WALL_SEARCH = 0.7;
const WALL_STEP = 0.05;

/**
 * A wall piece of a cave hung on the wall as drawn, not on its cell's edge: the outline wanders off
 * the cell grid, so the piece is moved along its facing until it hangs `OFF_WALL` off the drawn
 * wall, turned to that wall's own line. Where no wall is found near, it stays where it was placed.
 */
function onDrawnWall(prop: DungeonProp, field: FloorField): DungeonProp {
  const out = { x: -Math.sin(prop.rotation), y: Math.cos(prop.rotation) };
  const wall = { x: prop.x + out.x * OFF_WALL, y: prop.y + out.y * OFF_WALL };
  const at = (t: number): { x: number; y: number } => ({ x: wall.x + out.x * t, y: wall.y + out.y * t });
  let previous = field.distance(at(-WALL_SEARCH).x, at(-WALL_SEARCH).y);
  for (let t = -WALL_SEARCH + WALL_STEP; t <= WALL_SEARCH + 1e-9; t += WALL_STEP) {
    const p = at(t);
    const d = field.distance(p.x, p.y);
    if (previous < 0 && d >= 0) {
      const hit = at(t - WALL_STEP * (d / (d - previous)));
      const n = field.gradient(hit.x, hit.y);
      const len = Math.hypot(n.x, n.y);
      const into = len > 1e-9 ? { x: n.x / len, y: n.y / len } : out;
      return { ...prop, x: hit.x - into.x * OFF_WALL, y: hit.y - into.y * OFF_WALL, rotation: Math.atan2(-into.x, into.y) };
    }
    previous = d;
  }
  return prop;
}

/**
 * The props of the rooms on show, where the view shows them, each in the hand's finish. In a cave
 * the walls wander off the cell grid, so the props are clipped to the floor as drawn (the walls'
 * ink lies outside it and stays whole) and its wall pieces hang on the drawn wall.
 */
export function drawProps(hand: Hand, water: string, cloth: string): void {
  const { scene } = hand;
  const { dungeon, view, ctx } = scene.env;
  if (!view.props) return;
  const cave = dungeon.floor.cave !== undefined;
  if (cave) {
    ctx.save();
    clipFloors(scene);
  }
  for (const placed of dungeon.floor.props) {
    const glyph = propGlyph(placed.kind);
    if (!glyph || !dungeon.roomShapes.has(placed.room)) continue;
    const prop = cave && PROP_SPECS[placed.kind].wallPiece ? onDrawnWall(placed, dungeon.field) : placed;
    drawGlyph(hand, { ...prop, fit: glyphFit(prop) }, glyph, water, cloth);
  }
  if (cave) ctx.restore();
}

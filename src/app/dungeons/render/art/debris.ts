import { pointsBounds, traceSmoothClosed } from '../geometry';
import { taperedOutline } from '../debris';
import { castShadow, type Hand } from './hand';
import { clipFloors } from './outline';
import { polyPath, type PathFn } from './paths';

/** Rubble and cracks of a crumbling floor, where the view shows props. */
export function drawDebris(hand: Hand): void {
  const { ctx, dungeon, view } = hand.scene.env;
  if (!view.props) return;
  const stones = dungeon.floor.rubble;
  if (stones.length) {
    const all: PathFn = path => stones.forEach(s => traceSmoothClosed(path, s.points));
    castShadow(hand, all, 0.05, pointsBounds(stones.flatMap(s => s.points)), 0.5);
    hand.surface(all, 'stone');
    for (const s of stones) {
      const c = s.points.reduce((a, p) => ({ x: a.x + p.x / s.points.length, y: a.y + p.y / s.points.length }), { x: 0, y: 0 });
      hand.solid(path => traceSmoothClosed(path, s.points), c, 0.06, 1.2);
    }
    hand.line(stones.map(s => [...s.points, s.points[0]!]), 'fine');
  }
  if (dungeon.floor.cracks.length) {
    ctx.save();
    clipFloors(hand.scene);
    ctx.beginPath();
    for (const crack of dungeon.floor.cracks) {
      const outline = taperedOutline({ ...crack, width: crack.width * 0.5 });
      if (outline.length >= 3) polyPath(outline)(ctx);
    }
    ctx.fillStyle = hand.paint('floor').ink;
    ctx.fill();
    ctx.restore();
  }
}

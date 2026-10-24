/**
 * A house's windows (`DungeonFloor.windows`), drawn through a hand in the walls' own language: the
 * outer wall stops over the window's span (`clipOutsideMouths`), its two cut ends are closed by a
 * jamb line across the wall, and one thin line of glass runs along the edge between them.
 */

import type { DungeonWindow } from '../../model';
import { OUTER_WALL, windowSpan } from '../houseShapes';
import type { Vec } from '../geometry';
import type { VisibleFloor } from '../visibleDungeon';
import type { Hand } from './hand';

/** The windows of the rooms a view shows. */
export function shownWindows(dungeon: Pick<VisibleFloor, 'floor' | 'rooms'>): DungeonWindow[] {
  const windows = dungeon.floor.windows ?? [];
  if (windows.length === 0) return windows;
  const shown = new Set(dungeon.rooms.map((room) => room.id));
  return windows.filter((window) => shown.has(window.room));
}

/** The jambs across the wall at both ends of a window, and its pane along the edge. */
export function windowLines(window: DungeonWindow): { jambs: Vec[][]; pane: Vec[] } {
  const [a, b] = windowSpan(window);
  const half = OUTER_WALL / 2;
  const { dir } = window;
  const across = (p: Vec): Vec[] => [
    { x: p.x - dir.x * half, y: p.y - dir.y * half },
    { x: p.x + dir.x * half, y: p.y + dir.y * half },
  ];
  return { jambs: [across(a), across(b)], pane: [a, b] };
}

export function drawWindows(hand: Hand): void {
  for (const window of shownWindows(hand.scene.env.dungeon)) {
    const { jambs, pane } = windowLines(window);
    hand.line(jambs, 'outline');
    hand.line([pane], 'fine');
  }
}

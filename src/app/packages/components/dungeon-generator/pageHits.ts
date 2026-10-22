import type { CellPoint } from '../../../dungeons/model';
import { pointInPolygon } from '../../../dungeons/render/geometry';
import { pageToCell } from '../../../dungeons/render/pageMap';
import type { PageLayout, PageNote } from '../../../dungeons/render/renderPage';
import type { Rect } from '../../../dungeons/render/pageText';

/** A point on the drawn page, in its pixels. */
export interface PagePoint {
  x: number;
  y: number;
}

/** What lies under a point of the page, the topmost first: a note box, the title, the story, a room. */
export type PageHit =
  | { kind: 'note'; note: PageNote }
  | { kind: 'title'; rect: Rect }
  | { kind: 'story'; rect: Rect }
  | { kind: 'room'; room: number }
  | { kind: 'none' };

/** The page point under a client point, for a page drawn `pageWidth` pixels wide into `frame`. */
export function pagePointOf(client: PagePoint, frame: Pick<DOMRect, 'left' | 'top' | 'width'>, pageWidth: number): PagePoint {
  const scale = frame.width > 0 ? pageWidth / frame.width : 1;
  return { x: (client.x - frame.left) * scale, y: (client.y - frame.top) * scale };
}

/** A page rectangle in client coordinates, for placing an editor over it. */
export function clientRectOf(rect: Rect, frame: Pick<DOMRect, 'left' | 'top' | 'width'>, pageWidth: number): Rect {
  const scale = pageWidth > 0 ? frame.width / pageWidth : 1;
  return { x: frame.left + rect.x * scale, y: frame.top + rect.y * scale, w: rect.w * scale, h: rect.h * scale };
}

export function inRect(rect: Rect | null, p: PagePoint): rect is Rect {
  return rect !== null && p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

export function hitPage(layout: PageLayout, p: PagePoint): PageHit {
  // Later boxes are drawn over earlier ones.
  const note = [...layout.notes].reverse().find((entry) => inRect(entry.rect, p));
  if (note) return { kind: 'note', note };
  if (inRect(layout.title, p)) return { kind: 'title', rect: layout.title };
  if (inRect(layout.story, p)) return { kind: 'story', rect: layout.story };
  const room = layout.rooms.find((entry) => pointInPolygon(entry.outline, p.x, p.y));
  return room ? { kind: 'room', room: room.id } : { kind: 'none' };
}

/** Where a note box whose centre is dragged to `centre` lies, in cells (`DungeonNote.manual`). */
export function manualPlaceOf(layout: PageLayout, centre: PagePoint): CellPoint {
  return pageToCell(layout.map, centre);
}

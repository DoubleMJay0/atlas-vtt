import { stream } from '../rng';
import type { DungeonStyle, DungeonView } from '../style';
import { cssFont } from './fonts';
import { roomCentre, shapePolygon, type Canvas2D, type Vec } from './geometry';
import { drawNoteBox, measureNoteBox, type BoxLook, type NoteBoxText } from './noteBoxes';
import { placeBoxes } from './notePlacement';
import { cellToPage, type PageMapTransform } from './pageMap';
import type { Rect } from './pageText';
import type { Palette } from './palette';
import type { VisibleDungeon } from './visibleDungeon';

/** Note boxes measured and placed for one map layout, not yet drawn. */
export interface BoxPlan {
  look: BoxLook;
  tailed: boolean;
  entries: { ref: string; room: number; text: NoteBoxText; anchor: Vec; box: Rect }[];
  /** Boxes that found no free place. */
  clashes: number;
}

export interface PageFrame {
  width: number;
  height: number;
  margin: number;
  /** Page scale against the 1400 × 1000 page sizes are given for. */
  k: number;
  /** Title and story, which boxes keep clear of. */
  keepOut: Rect[];
  /** Which automatic arrangement of the boxes; each draws its places from a stream of its own. */
  arrangement: number;
}

/** Measures every visible note's box and places it around the map, the GM's places first. */
export function planBoxes(ctx: Canvas2D, dungeon: VisibleDungeon, style: DungeonStyle, view: DungeonView, map: PageMapTransform, frame: PageFrame): BoxPlan {
  const { k } = frame;
  const look: BoxLook = {
    font: cssFont(style.fonts.notes, style.fonts.notes.size * k),
    lineHeight: style.fonts.notes.size * k * 1.2,
    padding: 10 * k,
    radius: 10 * k,
    border: style.strokes.normal * k,
    maxWidth: 200 * k,
  };
  const tailed = view.notes === 'tailed';
  const notes = dungeon.model.notes.filter(note => dungeon.roomShapes.has(note.room));
  const texts = notes.map(note => measureNoteBox(ctx, tailed ? note.text : `${note.ref}. ${note.text}`, look));
  const anchors = notes.map(note => cellToPage(map, roomCentre(dungeon.rooms.find(r => r.id === note.room)!)));
  const keepOut = [...frame.keepOut];
  const entrance = dungeon.doors.find(d => d.kind === 'entrance');
  if (entrance) {
    const p = cellToPage(map, { x: entrance.x + 0.5, y: entrance.y + 0.5 });
    const r = map.scale * 1.5;
    keepOut.push({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });
  }
  // Rooms keep their hatching clear of boxes too.
  const grow = style.hatching.distance * 0.8;
  const polygons = dungeon.rooms.map(room => shapePolygon(dungeon.roomShapes.get(room.id)!, grow, 1).map(p => cellToPage(map, p)));
  const inset = frame.margin * 0.4;
  const { boxes, clashes } = placeBoxes(
    notes.map((note, i) => ({
      w: texts[i]!.w,
      h: texts[i]!.h,
      anchor: anchors[i]!,
      room: dungeon.rooms.findIndex(room => room.id === note.room),
      tail: tailed,
      ...(note.manual ? { manual: cellToPage(map, note.manual) } : {}),
    })),
    { x: inset, y: inset, w: frame.width - inset * 2, h: frame.height - inset * 2 },
    { polygons, rects: keepOut },
    6 * k,
    stream(dungeon.model.seed, 'notes', frame.arrangement || ''),
  );
  const entries = notes.map((note, i) => ({ ref: note.ref, room: note.room, text: texts[i]!, anchor: anchors[i]!, box: boxes[i]! }));
  return { look, tailed, entries, clashes };
}

export function drawPlannedBoxes(ctx: Canvas2D, plan: BoxPlan, palette: Palette): void {
  for (const entry of plan.entries) drawNoteBox(ctx, entry.box, entry.text, plan.look, palette, plan.tailed ? entry.anchor : null);
}

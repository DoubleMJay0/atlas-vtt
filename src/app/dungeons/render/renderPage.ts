import type { DungeonModel } from '../model';
import type { DungeonStyle, DungeonView } from '../style';
import { drawDungeon } from './drawDungeon';
import { cssFont } from './fonts';
import { shapePolygon, type Canvas2D, type Vec } from './geometry';
import { drawLegend, measureLegend } from './noteBoxes';
import { drawPlannedBoxes, planBoxes, type BoxPlan, type PageFrame } from './pageNotes';
import { applyPageMap, cellToPage, fitMap, type PageMapTransform } from './pageMap';
import { balancedWrap, drawCentredLines, widestLine, type Rect } from './pageText';
import { createRenderEnv } from './renderEnv';
import { drawLabels, roomLabels } from './roomLabels';
import { visibleDungeon } from './visibleDungeon';

/** The page Watabou's layout was made for; sizes scale with the page from it. */
const BASE_PAGE = { w: 1400, h: 1000 };
/** Shares of the free area the map is tried at when note boxes find no room around it. */
const SHRINK = [0.9, 0.8, 0.7, 0.6];

export interface PageNote {
  ref: string;
  room: number;
  /** The box (or the legend entry) on the page. */
  rect: Rect;
}

export interface PageRoom {
  id: number;
  /** The room's outline on the page. */
  outline: Vec[];
}

/** Where everything landed, for hit-testing: drag a note, right-click a room. */
export interface PageLayout {
  map: PageMapTransform;
  notes: PageNote[];
  rooms: PageRoom[];
  title: Rect | null;
  story: Rect | null;
}

/** The one-page layout: title and story, the map turned and scaled to fit, notes around it. */
export function renderPage(ctx: Canvas2D, model: DungeonModel, style: DungeonStyle, view: DungeonView, size: { width: number; height: number }): PageLayout {
  const { width, height } = size;
  const k = Math.min(width / BASE_PAGE.w, height / BASE_PAGE.h);
  const margin = 50 * k;
  const dungeon = visibleDungeon(model, view);
  const palette = createRenderEnv(ctx, dungeon, style, view, 1).palette;
  ctx.save();
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const heading = view.titleAndStory ? drawHeading(ctx, model, style, width, k, palette.ink) : { title: null, story: null, bottom: 0 };
  const noted = model.notes.filter(note => dungeon.roomShapes.has(note.room));
  const legendFont = cssFont(style.fonts.legend, style.fonts.legend.size * k);
  const legendLine = style.fonts.legend.size * k * 1.2;
  const legendWidth = 280 * k;
  const legend = view.notes === 'legend' && noted.length ? measureLegend(ctx, noted, legendFont, legendWidth, legendLine) : null;
  const top = Math.max(margin, heading.bottom + margin * 0.5);
  const left = legend ? margin + legendWidth + margin * 0.5 : margin;
  const area = { x: left, y: top, w: width - margin - left, h: height - margin - top };
  const boxed = view.notes === 'boxes' || view.notes === 'tailed';
  const frame: PageFrame = { width, height, margin, k, keepOut: [heading.title, heading.story].filter((r): r is Rect => r !== null) };
  // Boxes go in the room the map leaves; where they find none, the map gives up some of its area.
  let map = fitMap(dungeon, area, view, k, style.hatching.distance + 0.3);
  let plan: BoxPlan | null = boxed ? planBoxes(ctx, dungeon, style, view, map, frame) : null;
  for (const share of SHRINK) {
    if (!plan || plan.clashes === 0) break;
    const smaller = { x: area.x + (area.w * (1 - share)) / 2, y: area.y + (area.h * (1 - share)) / 2, w: area.w * share, h: area.h * share };
    const candidate = fitMap(dungeon, smaller, view, k, style.hatching.distance + 0.3);
    const next = planBoxes(ctx, dungeon, style, view, candidate, frame);
    if (next.clashes < plan.clashes) {
      map = candidate;
      plan = next;
    }
  }

  ctx.save();
  applyPageMap(ctx, map);
  drawDungeon(createRenderEnv(ctx, dungeon, style, view, map.scale, map.angle));
  ctx.restore();

  const rooms = dungeon.rooms.map(room => ({ id: room.id, outline: shapePolygon(dungeon.roomShapes.get(room.id)!, 0, 1).map(p => cellToPage(map, p)) }));
  const labels = roomLabels(dungeon, view.notes).map(label => ({ text: label.text, ...cellToPage(map, label.at) }));
  drawLabels(ctx, labels, cssFont(style.fonts.symbols, style.fonts.symbols.size * k), palette.ink, palette.floor, style.strokes.normal * 4 * k);

  let notes: PageNote[] = [];
  if (legend) {
    const at = { x: margin, y: height - margin - legend.height };
    const rects = drawLegend(ctx, legend, at, legendWidth, legendFont, legendLine, palette.ink);
    notes = noted.map((note, i) => ({ ref: note.ref, room: note.room, rect: rects[i]! }));
  } else if (plan) {
    drawPlannedBoxes(ctx, plan, palette);
    notes = plan.entries.map(entry => ({ ref: entry.ref, room: entry.room, rect: entry.box }));
  }
  return { map, notes, rooms, title: heading.title, story: heading.story };
}

function drawHeading(ctx: Canvas2D, model: DungeonModel, style: DungeonStyle, width: number, k: number, ink: string): { title: Rect | null; story: Rect | null; bottom: number } {
  ctx.save();
  ctx.fillStyle = ink;
  const available = width - 100 * k;
  let titlePx = style.fonts.title.size * k;
  ctx.font = cssFont(style.fonts.title, titlePx);
  const natural = ctx.measureText(model.title).width;
  if (natural > available) {
    titlePx *= available / natural;
    ctx.font = cssFont(style.fonts.title, titlePx);
  }
  const titleTop = 16 * k;
  const titleWidth = Math.min(natural, available);
  const titleBottom = drawCentredLines(ctx, [model.title], width / 2, titleTop, titlePx * 1.15);
  const title = model.title ? { x: (width - titleWidth) / 2, y: titleTop, w: titleWidth, h: titleBottom - titleTop } : null;
  let story: Rect | null = null;
  let bottom = title ? titleBottom : 0;
  if (model.story) {
    const storyPx = style.fonts.story.size * k;
    ctx.font = cssFont(style.fonts.story, storyPx);
    const lines = balancedWrap(ctx, model.story, Math.min(available, 820 * k));
    const top = bottom + 4 * k;
    bottom = drawCentredLines(ctx, lines, width / 2, top, storyPx * 1.2);
    const w = widestLine(ctx, lines);
    story = { x: (width - w) / 2, y: top, w, h: bottom - top };
  }
  ctx.restore();
  return { title, story, bottom };
}

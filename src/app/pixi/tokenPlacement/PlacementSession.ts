import type { TokenInput } from '../../types/viewState';
import { QUEUE_SHOWN, footprintCells, formationAt, queueCountOffset, queueSlot, type PlacementGrid, type Point } from './placementLayout';
import { HELD_SCALE, type PlacementGhost } from './PlacementGhost';
import type { PlacementMarks } from './PlacementMarks';

/** A token in the GM's hand: what will be added, where the spawn laid it out and its ghost. */
export interface HeldToken {
  readonly input: TokenInput;
  readonly home: Point;
  readonly size: number;
  readonly ghost: PlacementGhost;
}

export interface PlacementSessionDeps {
  /** The world point under a point of the canvas. */
  toWorld(screen: Point): Point;
  zoom(): number;
  /** The grid the tokens snap to and light the cells of; null where they are placed freely. */
  grid(): PlacementGrid | null;
  marks: PlacementMarks;
  /** Shows how many waiting tokens the queue leaves unshown, after its last place (world); null hides it. */
  count(at: Point | null, count: number): void;
  /** Adds `tokens` to the scene as they are put down (one undo step) and returns their ids. */
  commit(tokens: TokenInput[]): string[];
  /** Ghosts put down or taken away: they finish their motion outside the hand. */
  release(ghosts: PlacementGhost[]): void;
  /** The session ended with the ids of every token it placed. */
  end(placed: string[]): void;
}

/** How visible held tokens are while the pointer is off the map. */
const AWAY_ALPHA = 0.35;
const HELD_ALPHA = 0.92;
/** Seconds between the ripples of a formation put down, from the pointer outwards, at most `MAX_RIPPLE_DELAY` in all. */
const RIPPLE_DELAY_PER_CELL = 0.035;
const MAX_RIPPLE_DELAY = 0.2;

/**
 * Tokens spawned from the asset manager, held in the GM's hand until a click puts them on the map.
 * They follow the pointer laid out as the spawn arranged them (a formation, all put down at once);
 * while Shift is held they queue up instead, the first at the pointer and the rest waiting beside
 * it, and each click puts down the first. Releasing Shift lays out the rest again.
 */
export class PlacementSession {
  private hand: HeldToken[];
  private readonly placed: string[] = [];
  private pointer: Point;
  private shift = false;
  private onMap = true;
  private ended = false;
  /** Where each held token would be put down now, by its index in the hand. */
  private places: Point[] = [];

  constructor(private readonly deps: PlacementSessionDeps, hand: HeldToken[], start: Point) {
    this.hand = hand;
    this.pointer = start;
    this.arrange();
  }

  get active(): boolean {
    return !this.ended;
  }

  /** The pointer moved to `screen` (a canvas point) with Shift held or not. */
  moveTo(screen: Point, shift: boolean): void {
    if (this.ended) return;
    this.pointer = screen;
    this.shift = shift;
    this.onMap = true;
    this.arrange();
  }

  setShift(shift: boolean): void {
    if (this.ended || shift === this.shift) return;
    this.shift = shift;
    this.arrange();
  }

  /** The pointer left the map or came back to it: held tokens wait faintly where they were. */
  setOnMap(onMap: boolean): void {
    if (this.ended || onMap === this.onMap) return;
    this.onMap = onMap;
    this.arrange();
  }

  /** The map moved or zoomed under the pointer. */
  viewChanged(): void {
    if (!this.ended) this.arrange();
  }

  /** A click at `screen`: puts down every held token, or with Shift the first of the queue. */
  put(screen: Point, shift: boolean): void {
    if (this.ended) return;
    this.pointer = screen;
    this.shift = shift;
    this.onMap = true;
    this.arrange();
    const queued = this.queued();
    const count = queued ? 1 : this.hand.length;
    const batch = this.hand.slice(0, count);
    const places = this.places.slice(0, count);
    let ids: string[];
    try {
      ids = this.deps.commit(batch.map(({ input }, i) => ({ ...input, x: places[i]!.x, y: places[i]!.y })));
    } catch (error) {
      console.error('[TokenPlacement] Could not place the tokens:', error);
      this.cancel();
      return;
    }
    this.placed.push(...ids);
    this.land(batch, places);
    this.hand = this.hand.slice(count);
    if (this.hand.length === 0) {
      this.deps.count(null, 0);
      this.finish();
    }
    else this.arrange();
  }

  /** Takes the held tokens away without placing them. */
  cancel(): void {
    if (this.ended) return;
    for (const { ghost } of this.hand) ghost.vanish();
    this.deps.release(this.hand.map(({ ghost }) => ghost));
    this.hand = [];
    this.deps.marks.clear();
    this.deps.count(null, 0);
    this.finish();
  }

  private finish(): void {
    this.ended = true;
    this.deps.end(this.placed);
  }

  private queued(): boolean {
    return this.shift && this.hand.length > 1;
  }

  /** Poses every ghost for the pointer and lights the cells the tokens would cover. */
  private arrange(): void {
    const grid = this.deps.grid();
    const at = this.deps.toWorld(this.pointer);
    const alpha = this.onMap ? HELD_ALPHA : AWAY_ALPHA;
    const lit = new Map<string, Point[]>();
    const [head, ...waiting] = this.hand;
    if (!head) return;

    if (this.queued()) {
      const place = grid ? grid.snapToken(at, head.size) : at;
      this.places = [place];
      head.ghost.pose({ at: place, scale: HELD_SCALE, alpha, lift: 1 }, 'head');
      // The queue trails the token being placed, a constant size on screen
      const zoom = this.deps.zoom();
      const headRadius = (head.ghost.diameter * HELD_SCALE * zoom) / 2;
      const headOnScreen = { x: this.pointer.x + (place.x - at.x) * zoom, y: this.pointer.y + (place.y - at.y) * zoom };
      const fromHead = (offset: Point): Point => this.deps.toWorld({ x: headOnScreen.x + offset.x, y: headOnScreen.y + offset.y });
      waiting.forEach(({ ghost }, index) => {
        const slot = queueSlot(index, headRadius);
        ghost.pose({ at: fromHead(slot.offset), scale: slot.diameter / (ghost.diameter * zoom), alpha: slot.alpha * (this.onMap ? 1 : AWAY_ALPHA), lift: 0.3 }, `queue-${Math.min(index, QUEUE_SHOWN - 1)}`);
      });
      const unshown = waiting.length - QUEUE_SHOWN;
      this.deps.count(unshown > 0 ? fromHead(queueCountOffset(headRadius)) : null, unshown);
      if (grid && this.onMap) addCells(lit, place, head.size, grid);
    } else {
      this.deps.count(null, 0);
      this.places = formationAt(this.hand, at, grid);
      this.hand.forEach(({ ghost, size }, index) => {
        const place = this.places[index]!;
        ghost.pose({ at: place, scale: HELD_SCALE, alpha, lift: 1 }, 'formation');
        if (grid && this.onMap) addCells(lit, place, size, grid);
      });
    }
    this.deps.marks.light(lit);
  }

  /** The ghosts of tokens just put down press into the map; their cells flash and a ripple runs out from the pointer. */
  private land(batch: readonly HeldToken[], places: readonly Point[]): void {
    const grid = this.deps.grid();
    const pointer = this.deps.toWorld(this.pointer);
    const pitch = grid?.cellSize ?? Math.max(1, batch[0]?.ghost.diameter ?? 1);
    const cells = new Map<string, Point[]>();
    const ripples = batch.map(({ ghost, size }, i) => {
      const centre = places[i]!;
      ghost.land(centre);
      if (grid) addCells(cells, centre, size, grid);
      const cellsAway = Math.hypot(centre.x - pointer.x, centre.y - pointer.y) / pitch;
      return { centre, radius: ghost.diameter / 2, delay: Math.min(MAX_RIPPLE_DELAY, cellsAway * RIPPLE_DELAY_PER_CELL) };
    });
    this.deps.marks.land(cells, ripples);
    this.deps.release(batch.map(({ ghost }) => ghost));
  }
}

/** Adds the outlines of the cells a token of `size` covers at `centre`, keyed by their centres. */
function addCells(into: Map<string, Point[]>, centre: Point, size: number, grid: PlacementGrid): void {
  for (const cell of footprintCells(centre, size, grid)) {
    into.set(`${Math.round(cell.x * 8)},${Math.round(cell.y * 8)}`, grid.cellOutline(cell));
  }
}

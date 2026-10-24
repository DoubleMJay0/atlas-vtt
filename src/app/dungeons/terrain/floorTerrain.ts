/**
 * One floor's terrain while it is being placed: each room's cells (`RoomCells`), the pieces
 * placed so far and the furniture placed on whole cells with them. A piece goes in only where its room allows it (free cells, the room still whole);
 * pieces decided across floors (a hole and the floor under it) are held first and added as they are.
 */

import { DRAWN_TERRAIN_KINDS } from '../drawnKinds';
import type { CellPoint, DungeonColumn, DungeonDoor, DungeonProp, DungeonRoom, DungeonStair, DungeonTerrain, TerrainKind } from '../model';
import { cellKey, floorRect, inRect } from '../geometry';
import { type TerrainDraft, footingOf } from './catalog';
import { RoomCells } from './roomCells';

export interface FloorPlan {
  rooms: readonly DungeonRoom[];
  doors: readonly DungeonDoor[];
  stairs: readonly DungeonStair[];
  columns: readonly DungeonColumn[];
  /** The kinds that may be placed; unset, those with a drawing (`DRAWN_TERRAIN_KINDS`). Tests of placement offer every kind. */
  offeredTerrain?: ReadonlySet<TerrainKind>;
}

export class FloorTerrain {
  readonly pieces: DungeonTerrain[] = [];
  /** Furniture placed on whole cells with the terrain (the recipes of typed rooms). */
  readonly props: DungeonProp[] = [];
  /** The cells that furniture stands on, by key. */
  private readonly furnished = new Set<string>();
  private readonly cells = new Map<number, RoomCells>();

  constructor(
    readonly index: number,
    readonly plan: FloorPlan,
  ) {
    for (const room of plan.rooms) {
      if (room.kind !== 'room') continue;
      this.cells.set(room.id, new RoomCells(room, plan.doors, plan.stairs, index, plan.columns));
    }
  }

  /** The cells of a normal room; undefined for corridors and junctions, which take no terrain. */
  room(id: number): RoomCells | undefined {
    return this.cells.get(id);
  }

  /** The normal room whose floor holds every one of `cells`, if one does. */
  roomHolding(cells: readonly CellPoint[]): RoomCells | undefined {
    const first = cells[0];
    if (!first) return undefined;
    const room = this.plan.rooms.find((r) => r.kind === 'room' && inRect(floorRect(r), first.x, first.y));
    const rc = room && this.cells.get(room.id);
    return rc && cells.every((c) => rc.isFloor(c)) ? rc : undefined;
  }

  /** Places `piece` if its kind is offered and its room allows it; a bridge's cells on the hole it crosses stay walkable. Its id, or null. */
  place(piece: TerrainDraft, bridges: readonly CellPoint[] = []): number | null {
    const rc = this.cells.get(piece.room);
    if (!rc || !(this.plan.offeredTerrain ?? DRAWN_TERRAIN_KINDS).has(piece.kind) || !rc.allows(piece.cells, footingOf(piece.kind), bridges)) return null;
    rc.take(piece.cells, footingOf(piece.kind));
    return this.push(piece);
  }

  /** A bridge over the piece `spans`: its cells lie on that piece's, so they are walked again. */
  addBridge(piece: TerrainDraft, spans: number): number {
    this.cells.get(piece.room)?.bridge(piece.cells);
    return this.push({ ...piece, spans });
  }

  /** Adds a piece whose cells were held for it (`hold`), with no further check. */
  addHeld(piece: TerrainDraft): number {
    this.cells.get(piece.room)?.take(piece.cells, footingOf(piece.kind));
    return this.push(piece);
  }

  /** Adds furniture whose cells (`cells`) its room has taken. */
  addProp(prop: DungeonProp, cells: readonly CellPoint[] = []): void {
    this.props.push(prop);
    for (const c of cells) this.furnished.add(cellKey(c.x, c.y));
  }

  /** Every cell furniture stands on, by key: water keeps dry under it. */
  propCells(): Set<string> {
    return new Set(this.furnished);
  }

  /** Every cell any piece fills, by key. */
  takenCells(): Set<string> {
    return new Set(this.pieces.flatMap((p) => p.cells.map((c) => cellKey(c.x, c.y))));
  }

  /** The pieces in a room. */
  inRoom(id: number): DungeonTerrain[] {
    return this.pieces.filter((p) => p.room === id);
  }

  private push(piece: TerrainDraft): number {
    const id = this.pieces.length;
    this.pieces.push({ ...piece, id });
    return id;
  }
}

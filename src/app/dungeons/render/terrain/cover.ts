import type { DungeonTerrain } from '../../model';
import type { Vec } from '../geometry';
import type { Hand } from '../art/hand';
import { polyPath, rectPoly } from '../art/paths';
import { boxOf, CRATE_SPOTS, INSET, lengthX, lowWallBox, type Box } from './footprints';
import { clearOfCaveWall, pieceRng } from './pieces';
import { stoneOutline } from './stones';

/** Half cover a party can shoot over: crates, a table, an altar, a sarcophagus, a heap of rubble, a low wall. */

const rot = (c: Vec, a: number, p: Vec): Vec => ({ x: c.x + (p.x - c.x) * Math.cos(a) - (p.y - c.y) * Math.sin(a), y: c.y + (p.x - c.x) * Math.sin(a) + (p.y - c.y) * Math.cos(a) });

export function drawCrates(hand: Hand, piece: DungeonTerrain): void {
  const rng = pieceRng(hand.scene.env, piece);
  for (const c of piece.cells) {
    for (const [dx, dy, s] of CRATE_SPOTS) {
      const centre = { x: c.x + dx, y: c.y + dy };
      const a = (rng() - 0.5) * 0.4;
      const sq = rectPoly({ x: centre.x - s / 2, y: centre.y - s / 2, w: s, h: s }).map(p => rot(centre, a, p));
      const inner = rectPoly({ x: centre.x - s / 2 + 0.055, y: centre.y - s / 2 + 0.055, w: s - 0.11, h: s - 0.11 }).map(p => rot(centre, a, p));
      hand.surface(polyPath(sq), 'wood');
      hand.line([[...inner, inner[0]!], [inner[3]!, inner[1]!]], 'fine');
      hand.edges(sq, true);
    }
  }
}

function boardsOf(box: Box, along: boolean, width: number): Vec[][] {
  const out: Vec[][] = [];
  const n = Math.max(2, Math.round((along ? box.h : box.w) / width));
  for (let k = 1; k < n; k++) {
    const t = k / n;
    out.push(along ? [{ x: box.x, y: box.y + box.h * t }, { x: box.x + box.w, y: box.y + box.h * t }] : [{ x: box.x + box.w * t, y: box.y }, { x: box.x + box.w * t, y: box.y + box.h }]);
  }
  return out;
}

export function drawTable(hand: Hand, piece: DungeonTerrain): void {
  const box = boxOf(piece, INSET.table);
  const top = rectPoly(box);
  hand.surface(polyPath(top), 'wood');
  hand.line(boardsOf(box, !lengthX(piece), 0.22), 'fine');
  hand.edges(top, true);
}

/** A stone altar: a bevelled block, a runner of cloth laid across it, a candle at each end. */
export function drawAltar(hand: Hand, piece: DungeonTerrain): void {
  const box = boxOf(piece, INSET.altar);
  const along = lengthX(piece);
  bevelledBlock(hand, box, 0.07);
  const runner = along ? rectPoly({ x: box.cx - box.w * 0.18, y: box.y - 0.04, w: box.w * 0.36, h: box.h + 0.08 }) : rectPoly({ x: box.x - 0.04, y: box.cy - box.h * 0.18, w: box.w + 0.08, h: box.h * 0.36 });
  hand.surface(polyPath(runner), 'cloth');
  hand.edges(runner, true);
  const end = (along ? box.w : box.h) / 2 - 0.14;
  for (const side of [-1, 1]) {
    const c = along ? { x: box.cx + side * end, y: box.cy } : { x: box.cx, y: box.cy + side * end };
    const disc = circle(c, 0.06, 12);
    hand.surface(polyPath(disc), 'metal');
    hand.edges(disc, true);
  }
}

export function drawSarcophagus(hand: Hand, piece: DungeonTerrain): void {
  const box = boxOf(piece, INSET.sarcophagus);
  const along = lengthX(piece);
  bevelledBlock(hand, box, 0.09);
  const ridge: Vec[] = along ? [{ x: box.x + box.w * 0.2, y: box.cy }, { x: box.x + box.w * 0.8, y: box.cy }] : [{ x: box.cx, y: box.y + box.h * 0.2 }, { x: box.cx, y: box.y + box.h * 0.8 }];
  hand.line([ridge], 'outline');
}

/** A block cut from stone: its top and a bevel stepping down to its foot. */
export function bevelledBlock(hand: Hand, box: Box, bevel: number): void {
  const outer = rectPoly(box);
  const inner = rectPoly({ x: box.x + bevel, y: box.y + bevel, w: box.w - bevel * 2, h: box.h - bevel * 2 });
  hand.surface(polyPath(outer), 'dressed');
  hand.line([[...inner, inner[0]!], ...[0, 1, 2, 3].map(k => [outer[k]!, inner[k]!])], 'fine');
  hand.edges(outer, true);
}

export function circle(c: Vec, r: number, n = 24): Vec[] {
  return Array.from({ length: n }, (_, k) => ({ x: c.x + Math.cos((k / n) * Math.PI * 2) * r, y: c.y + Math.sin((k / n) * Math.PI * 2) * r }));
}

/** A heap of stones: larger in its middle, smaller at its foot, each lit and shading the next. */
export function drawRubbleHeap(hand: Hand, piece: DungeonTerrain): void {
  const rng = pieceRng(hand.scene.env, piece);
  const stones: { poly: Vec[]; c: Vec; r: number }[] = [];
  for (const cell of piece.cells) {
    const mid = { x: cell.x + 0.5, y: cell.y + 0.5 };
    for (let i = 0; i < 18; i++) {
      const c = { x: cell.x + 0.12 + rng() * 0.76, y: cell.y + 0.12 + rng() * 0.76 };
      const u = Math.min(1, Math.hypot(c.x - mid.x, c.y - mid.y) / 0.5);
      const r = (0.07 + 0.13 * (1 - u) ** 0.8) * (0.75 + rng() * 0.5);
      stones.push({ poly: stoneOutline(rng, c, r), c, r });
    }
  }
  stones.sort((p, q) => p.r - q.r);
  for (const s of stones.filter((st) => clearOfCaveWall(hand.scene.env, st.c, st.r))) {
    const path = polyPath(s.poly);
    hand.surface(path, 'rock');
    hand.solid(path, s.c, s.r, 1.3);
    hand.line([s.poly], 'fine', true);
  }
}

/** A low wall: a course of blocks narrower than a room's wall, its top lit. */
export function drawLowWall(hand: Hand, piece: DungeonTerrain): void {
  const box = lowWallBox(piece);
  const along = lengthX(piece);
  const outer = rectPoly(box);
  hand.surface(polyPath(outer), 'dressed');
  const joints: Vec[][] = [];
  const len = along ? box.w : box.h;
  for (let s = 0.32; s < len - 0.12; s += 0.34) joints.push(along ? [{ x: box.x + s, y: box.y }, { x: box.x + s, y: box.y + box.h }] : [{ x: box.x, y: box.y + s }, { x: box.x + box.w, y: box.y + s }]);
  hand.line(joints, 'fine');
  hand.edges(outer, true);
}

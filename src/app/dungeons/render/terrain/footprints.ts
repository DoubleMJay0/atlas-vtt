import type { CellDir, DungeonTerrain, TerrainKind } from '../../model';
import { roundedRect } from '../glyphPen';
import type { PathFn } from '../art/paths';
import { cellBox } from './cellRings';

/**
 * Where standing terrain stands, in cells: the shapes its drawing fills and the scene's object
 * outlines lie inside (`scene/objectShadows.ts` reads these numbers), and how tall it stands
 * against a wall (1), for the shadows it casts.
 */

/** How far inside its cells a block-shaped piece is drawn. */
export const INSET = { table: 0.12, altar: 0.14, sarcophagus: 0.16, pillar: 0.1, obelisk: 0.14, statue: 0.18 } as const satisfies Partial<Record<TerrainKind, number>>;

const insetOf = (kind: TerrainKind): number => (INSET as Partial<Record<TerrainKind, number>>)[kind] ?? 0.12;
/** A wall fragment: half its thickness, and how far its broken ends stop short of its cells. */
export const FRAGMENT = { half: 0.17, ends: 0.12 };
/** A low wall's thickness. */
export const LOW_WALL = 0.3;
/** Where a cell's crates stand and how large they are: x, y and side, in cells. */
export const CRATE_SPOTS = [
  [0.3, 0.3, 0.42],
  [0.71, 0.33, 0.36],
  [0.52, 0.71, 0.44],
] as const;
/** The standing stones of a portal ring, and each one's radius. */
export const RING_STONES = 8;
export const RING_STONE = 0.13;

/** How tall each piece stands, a wall's height being 1. */
export const HEIGHT: Readonly<Partial<Record<TerrainKind, number>>> = {
  'low-wall': 0.4,
  crates: 0.45,
  table: 0.32,
  altar: 0.4,
  sarcophagus: 0.36,
  'rubble-heap': 0.42,
  pillar: 1,
  statue: 0.85,
  'wall-fragment': 1,
  obelisk: 1,
  lever: 0.18,
  pool: 0.14,
  'portal-ring': 0.6,
  pews: 0.18,
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export function boxOf(piece: DungeonTerrain, inset: number): Box {
  const b = cellBox(piece.cells);
  return { x: b.x + inset, y: b.y + inset, w: b.w - inset * 2, h: b.h - inset * 2, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}

/** Whether a piece lies along x (wider than deep). */
export function lengthX(piece: DungeonTerrain): boolean {
  const b = cellBox(piece.cells);
  return b.w >= b.h;
}

/** A wall fragment's slab, along its longer side. */
export function fragmentBox(piece: DungeonTerrain): Box {
  const box = boxOf(piece, 0);
  const along = lengthX(piece);
  const w = along ? box.w - FRAGMENT.ends * 2 : FRAGMENT.half * 2;
  const h = along ? FRAGMENT.half * 2 : box.h - FRAGMENT.ends * 2;
  return { x: box.cx - w / 2, y: box.cy - h / 2, w, h, cx: box.cx, cy: box.cy };
}

/** A low wall's band, along its longer side. */
export function lowWallBox(piece: DungeonTerrain): Box {
  const box = boxOf(piece, 0.05);
  const along = lengthX(piece);
  const w = along ? box.w : LOW_WALL;
  const h = along ? LOW_WALL : box.h;
  return { x: box.cx - w / 2, y: box.cy - h / 2, w, h, cx: box.cx, cy: box.cy };
}

/** The portal ring's radius in its box. */
export function ringRadius(piece: DungeonTerrain): number {
  const box = boxOf(piece, 0.04);
  return Math.min(box.w, box.h) / 2 - 0.12;
}

const rectPath = (box: Box, r = 0.03): PathFn => path => roundedRect(path as CanvasRenderingContext2D, box.cx, box.cy, box.w, box.h, r);

/** The shape a standing piece fills, for its shadow; none for what lies on the ground. */
export function footprint(piece: DungeonTerrain, axis: CellDir): PathFn | null {
  switch (piece.kind) {
    case 'crates':
      return path => {
        for (const c of piece.cells) for (const [dx, dy, s] of CRATE_SPOTS) path.rect(c.x + dx - s / 2, c.y + dy - s / 2, s, s);
      };
    case 'rubble-heap':
      return path => {
        for (const c of piece.cells) {
          path.moveTo(c.x + 0.86, c.y + 0.5);
          path.arc(c.x + 0.5, c.y + 0.5, 0.36, 0, Math.PI * 2);
        }
      };
    case 'low-wall':
      return rectPath(lowWallBox(piece), 0.02);
    case 'wall-fragment':
      return rectPath(fragmentBox(piece), 0.02);
    case 'pool': {
      const box = boxOf(piece, 0.1);
      return path => {
        path.moveTo(box.cx + Math.min(box.w, box.h) / 2, box.cy);
        path.arc(box.cx, box.cy, Math.min(box.w, box.h) / 2, 0, Math.PI * 2);
      };
    }
    case 'portal-ring': {
      const box = boxOf(piece, 0.04);
      const r = ringRadius(piece);
      return path => {
        for (let k = 0; k < RING_STONES; k++) {
          const a = (k / RING_STONES) * Math.PI * 2;
          path.moveTo(box.cx + Math.cos(a) * r + RING_STONE, box.cy + Math.sin(a) * r);
          path.arc(box.cx + Math.cos(a) * r, box.cy + Math.sin(a) * r, RING_STONE, 0, Math.PI * 2);
        }
      };
    }
    case 'pews':
      return path => {
        for (const c of piece.cells) {
          const b = pewBox(c, axis);
          path.rect(b.x, b.y, b.w, b.h);
        }
      };
    case 'lever':
    case 'table':
    case 'altar':
    case 'sarcophagus':
    case 'pillar':
    case 'obelisk':
    case 'statue':
      return rectPath(boxOf(piece, insetOf(piece.kind)));
    default:
      return null;
  }
}

/** A pew's bench in its cell: across the room's axis, a little towards the far wall. */
export function pewBox(c: { x: number; y: number }, axis: CellDir): Box {
  const across = axis.x === 0;
  const w = across ? 0.9 : 0.34;
  const h = across ? 0.34 : 0.9;
  const cx = c.x + 0.5 + axis.x * 0.08;
  const cy = c.y + 0.5 + axis.y * 0.08;
  return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
}

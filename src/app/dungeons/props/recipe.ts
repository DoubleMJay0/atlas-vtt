/**
 * A typed room furnished by its type's recipe: the defining piece first (with what belongs to
 * it), then the other pieces in order by verb. Deeper rooms of a repeated type get more of their
 * optional pieces (the depth ladder), the theme's richness scales them after that, and in a
 * haunted house some are under dust sheets. A defining piece that cannot be placed (not drawn yet,
 * or no room for it) leaves the room typed and bare: a kitchen without its range is no kitchen.
 */

import { dir } from '../geometry';
import type { CellPoint, DungeonProp, PropKind } from '../model';
import { chance, int } from '../rng';
import type { FurnishRecipe, Piece } from '../themes/themeTypes';
import { dais } from './arrange';
import { aroundParent, flanking, inGrid, onShore } from './arrangeGroups';
import { PROP_SPECS, isCellPiece } from './catalogue';
import { againstWall, atBackWall, atCentre, inCorner, inRows, onWall } from './cellVerbs';
import type { FurnishSpace, PlacedPiece } from './furnishSpace';
import { occupyCells } from './space';

export interface RecipeContext {
  /** 0 for the shallowest room of its type, 1 for the deepest; 0.5 for a type held once. */
  depthRank: number;
  ruined: boolean;
  /** The chance each optional piece lies under a dust sheet (broken furniture in a ruin). */
  sheeted: number;
  /** The theme's richness for the room, 0..1; 1 knowing nothing more. */
  richness: number;
}

const lastOf = (fs: FurnishSpace, kind: PropKind | undefined): PlacedPiece | undefined => (kind ? fs.placed.findLast((p) => p.prop.kind === kind) : undefined);

/** The room's free cells whose middles lie within `half` cells of a prop's middle across its front and `from`..`to` cells ahead of it. */
function cellsUnder(fs: FurnishSpace, prop: DungeonProp, half: number, from: number, to: number): CellPoint[] {
  const { cells: rc } = fs;
  const out: CellPoint[] = [];
  const front = { x: Math.sin(prop.rotation), y: -Math.cos(prop.rotation) };
  for (let i = 0; i < rc.depth; i++) {
    for (let j = 0; j < rc.width; j++) {
      const c = rc.cell(i, j);
      const dx = c.x + 0.5 - prop.x;
      const dy = c.y + 0.5 - prop.y;
      const ahead = dx * front.x + dy * front.y;
      if (ahead > from && ahead < to && Math.abs(dx * front.y - dy * front.x) < half && rc.isFree(c)) out.push(c);
    }
  }
  return out;
}

/** The cells a piece set on a dais stands on: its box for a cell piece, its own cell for a disc. */
function itemCells(fs: FurnishSpace, prop: DungeonProp): CellPoint[] {
  const spec = PROP_SPECS[prop.kind];
  if (!isCellPiece(spec)) return [{ x: Math.floor(prop.x), y: Math.floor(prop.y) }];
  return cellsUnder(fs, prop, spec.footprint.along / 2, -spec.footprint.out / 2, spec.footprint.out / 2);
}

/**
 * A dais against the back wall with `item` on it, the item only where it is offered and the room
 * stays whole with it; the dais' cells taken walkable, the item's as it stands.
 */
function onDais(fs: FurnishSpace, item: PropKind | undefined): DungeonProp[] {
  if (!fs.offered.has('dais')) return [];
  // The dais verb always seats something; an item not offered is left off it.
  const [platform, seated] = dais(fs.space, fs.doors, item ?? 'dais');
  if (!platform) return [];
  const { cells: rc } = fs;
  const under = seated && item !== undefined && fs.offered.has(item) ? itemCells(fs, seated) : [];
  const keeps = seated !== undefined && under.length > 0 && rc.allows(under, PROP_SPECS[seated.kind].footing ?? 'block');
  if (keeps) rc.take(under, PROP_SPECS[seated.kind].footing ?? 'block');
  const cells = cellsUnder(fs, platform, 1.5 * platform.scale, 0, 1.35 * platform.scale);
  rc.take(cells, 'walk');
  occupyCells(fs.space, [...cells, ...(keeps ? under : [])]);
  const props = keeps ? [platform, seated] : [platform];
  for (const prop of props) {
    const own = prop === platform ? cells : under;
    fs.floor.addProp(prop, own);
    fs.placed.push({ prop, cells: own, clear: [], facing: dir(Math.round(Math.sin(prop.rotation)), Math.round(-Math.cos(prop.rotation))) });
  }
  return props;
}

/** One piece of a recipe by its verb, `count` of it; what it placed. */
function placeByVerb(fs: FurnishSpace, piece: Piece, kind: PropKind, count: number, defining: PlacedPiece | undefined): DungeonProp[] {
  const repeat = (place: () => DungeonProp | null): DungeonProp[] => Array.from({ length: count }, place).filter((p): p is DungeonProp => p !== null);
  switch (piece.verb) {
    case 'backWall':
      return repeat(() => atBackWall(fs, kind));
    case 'wall':
      if (PROP_SPECS[kind].wallPiece) return onWall(fs, kind, count);
      return repeat(() => againstWall(fs, kind, ['back', 'left', 'right', 'near']));
    case 'rows':
      return inRows(fs, kind, count);
    case 'centre':
      return repeat(() => atCentre(fs, kind));
    case 'corner':
      return repeat(() => inCorner(fs, kind));
    case 'flank':
      return Array.from({ length: count }).flatMap(() => flanking(fs, kind, piece.of === 'door' ? 'door' : (defining ?? null)));
    case 'withParent': {
      const parent = lastOf(fs, piece.parent);
      return parent ? aroundParent(fs, kind, parent, count) : [];
    }
    case 'grid':
      return inGrid(fs, kind, count);
    case 'shore':
      return onShore(fs, kind, count);
  }
}

const countOf = (fs: FurnishSpace, piece: Piece): number => (piece.count ? int(fs.rng, piece.count[0], piece.count[1]) : 1);

/** The room's furniture by its recipe, in order; what was placed. */
export function furnishByRecipe(fs: FurnishSpace, recipe: FurnishRecipe, context: RecipeContext): DungeonProp[] {
  const out: DungeonProp[] = [];
  const { defining, with: belonging } = recipe;
  let definingPiece: PlacedPiece | undefined;
  if (defining) {
    const placed = defining.kind === 'dais' ? onDais(fs, belonging?.kind) : placeByVerb(fs, defining, defining.kind, countOf(fs, defining), undefined);
    if (placed.length === 0) return out;
    out.push(...placed);
    definingPiece = fs.placed.find((p) => p.prop === placed[0]);
    if (belonging && defining.kind !== 'dais') out.push(...placeByVerb(fs, belonging, belonging.kind, countOf(fs, belonging), definingPiece));
  }
  const sheet: PropKind = context.ruined ? 'broken-furniture' : 'dust-sheet';
  for (const piece of recipe.pieces) {
    const odds = Math.min(1, (piece.chance ?? 1) * (0.7 + 0.6 * context.depthRank)) * context.richness;
    if (!chance(fs.rng, odds)) continue;
    const count = countOf(fs, piece);
    // A piece placed by its parent keeps its kind: a sheet over a chair stands for no chair.
    const sheeted = piece.verb !== 'withParent' && context.sheeted > 0 && chance(fs.rng, context.sheeted);
    out.push(...placeByVerb(fs, piece, sheeted ? sheet : piece.kind, count, definingPiece));
  }
  return out;
}

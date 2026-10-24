/**
 * Every kind of furniture a dungeon may hold. Ids are stored in models and exports and never
 * translated or renamed; names are `t('dungeonProp.name.<propKey>')`. The eleven kinds of the first
 * generator come first, in the order a room's note lists them, then the catalogue's.
 */

import { idKey } from '../idKey';

export const PROP_KINDS = [
  'dais',
  'throne',
  'altar',
  'statue',
  'fountain',
  'well',
  'sarcophagus',
  'tapestry',
  'chest',
  'crate',
  'barrel',
  'table',
  'long-table',
  'high-table',
  'bench',
  'chair',
  'stool',
  'hearth',
  'range',
  'work-table',
  'shelves',
  'sacks',
  'weapon-rack',
  'armour-stand',
  'workbench',
  'bunk',
  'bed',
  'four-poster-bed',
  'cot',
  'desk',
  'wardrobe',
  'dressing-table',
  'rug',
  'candle-stand',
  'latrine',
  'cell-bars',
  'stall',
  'trough',
  'hay',
  'bookshelf',
  'bust',
  'portrait',
  'brazier',
  'sofa',
  'armchair',
  'low-table',
  'piano',
  'cabinet',
  'sideboard',
  'side-table',
  'coat-stand',
  'dresser',
  'sink',
  'planter',
  'washstand',
  'bathtub',
  'rocking-chair',
  'barrel-rack',
  'bottle-rack',
  'wash-tub',
  'drying-line',
  'dust-sheet',
  'broken-furniture',
  'alembic-table',
  'telescope',
  'star-chart',
  'stalagmites',
  'column-formation',
  'flowstone',
  'curtain',
  'crystals',
  'mushrooms',
  'boulder',
  'nest',
  'campfire',
  'bedroll',
  'crude-table',
  'pen',
] as const;

export type PropKind = (typeof PROP_KINDS)[number];

export const ALL_PROP_KINDS: ReadonlySet<PropKind> = new Set(PROP_KINDS);

/** The i18n key segment of a kind (`long-table` → `longTable`). */
export function propKey(kind: PropKind): string {
  return idKey(kind);
}

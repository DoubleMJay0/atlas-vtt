/**
 * Every room type a theme's programme may give a room: what it was built for. Ids are stored in
 * models and exports and never translated or renamed; names are `t('dungeonRoom.<roomTypeKey>')`.
 * Types two themes share (a kitchen, a library, a collapsed room) appear once.
 */

import { idKey } from '../idKey';

export const ROOM_TYPE_IDS = [
  'gatehouse',
  'antechamber',
  'great-hall',
  'lower-hall',
  'throne-room',
  'kitchen',
  'buttery',
  'storeroom',
  'barracks',
  'armoury',
  'chapel',
  'solar',
  'chamber',
  'garderobe',
  'gaol',
  'cistern',
  'stable',
  'library',
  'gallery',
  'stair-hall',
  'collapsed-room',
  'entrance-hall',
  'drawing-room',
  'dining-room',
  'servery',
  'scullery',
  'servants-hall',
  'wine-cellar',
  'laundry',
  'study',
  'ballroom',
  'conservatory',
  'master-bedroom',
  'bedroom',
  'nursery',
  'bathroom',
  'attic-room',
  'laboratory',
  'observatory',
  'portrait-gallery',
  'ritual-room',
  'landing',
  'cave-mouth',
  'passage-chamber',
  'grand-cavern',
  'flowstone-gallery',
  'lake-cavern',
  'stream-passage',
  'sump',
  'chasm-hall',
  'collapse-chamber',
  'shaft-room',
  'fungus-grove',
  'crystal-grotto',
  'lava-tube',
  'sulphur-spring',
  'roost',
  'den',
  'guard-post',
  'lived-in-hollow',
  'fire-hollow',
  'pen',
  'store-hollow',
  'chief-den',
] as const;

export type RoomTypeId = (typeof ROOM_TYPE_IDS)[number];

/** The i18n key segment of a room type (`great-hall` → `greatHall`). */
export function roomTypeKey(id: RoomTypeId): string {
  return idKey(id);
}

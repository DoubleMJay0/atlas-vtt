import { t, type MessageKey } from '../../i18n';
import { en } from '../../i18n/locales/en';
import type { DungeonTerrain } from '../model';

const isMessageKey = (key: string): key is MessageKey => Object.hasOwn(en, key);

/**
 * What a piece of terrain is called, for the GM's note and hover label. The piece names its text
 * by an i18n key (`DungeonTerrain.name`, model data an export carries); a key this version has no
 * text for reads as the piece's kind.
 */
export function terrainName(piece: Pick<DungeonTerrain, 'name' | 'kind'>): string {
  return isMessageKey(piece.name) ? t(piece.name) : piece.kind.replace(/-/g, ' ');
}

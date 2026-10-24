import { describe, expect, it } from 'vitest';
import { ROOM_TYPE_IDS, roomTypeKey } from '../../../src/app/dungeons/themes/roomTypes';
import { type MessageKey, t } from '../../../src/app/i18n';

describe('room type names', () => {
  it('names every room type in English', () => {
    for (const id of ROOM_TYPE_IDS) {
      const key = `dungeonRoom.${roomTypeKey(id)}`;
      expect(t(key as MessageKey), id).not.toBe(key);
    }
  });

  it('has no id twice', () => {
    expect(new Set(ROOM_TYPE_IDS).size).toBe(ROOM_TYPE_IDS.length);
  });
});

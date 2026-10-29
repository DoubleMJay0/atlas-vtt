import { describe, expect, it } from 'vitest';
import type { AssetStoring, FloorMaps } from '../../../../src/app/online/gm/assets/assetUses.ts';
import { sha256Hex } from '../../../../src/app/online/gm/assetServe.ts';
import type { SceneState } from '../../../../src/app/online/gm/atlasView.ts';
import { floorMaps } from '../../../../src/app/online/gm/floorMaps.ts';
import type { SeatSource } from '../../../../src/app/online/gm/seatSource.ts';
import type { TokenEntity } from '../../../../src/app/types';
import type { SceneLevel } from '../../../../src/app/types/sceneLevelTypes';
import { sceneState, shareHarness, token } from './shareHarness.ts';

const ANA = 'a'.repeat(20);
const BEN = 'b'.repeat(20);
const LEVELS: SceneLevel[] = [
  { id: 'ground', name: 'Ground', elevation: { bottom: 0, top: 10 }, background: 'maps/ground.webp' },
  { id: 'cellar', name: 'Cellar', elevation: { bottom: -10, top: 0 }, background: 'maps/cellar.webp' },
  { id: 'vault', name: 'Vault', elevation: { bottom: -20, top: -10 }, background: 'maps/vault.webp' },
];
const IMAGES = new Map(LEVELS.map((level, n) => [level.background!, new Uint8Array(64).map((_, index) => (index * (n + 3)) % 256)]));
const OWNERS: Readonly<Record<string, string>> = { ana: ANA, ben: BEN };

/** Three floors: Ana on the ground, Ben where `benOn` says. */
function scene(benOn: string): SceneState {
  const state = sceneState({ levels: LEVELS, viewedLevel: 'ground', background: 'maps/ground.webp' });
  const tokens: Record<string, TokenEntity> = { ana: token('ana', { x: 100, y: 100 }), ben: token('ben', { x: 100, y: 100, level: benOn }) };
  return { ...state, objects: { ...state.objects, tokens } };
}

/** References without a store, and every report of the floors' maps. */
function storing(): { stored: AssetStoring; reports: FloorMaps[] } {
  const reports: FloorMaps[] = [];
  const plain = async (bytes: Uint8Array<ArrayBuffer>, mime: string): Promise<{ hash: string; size: number; mime: string }> => ({ hash: await sha256Hex(bytes), size: bytes.length, mime });
  return {
    reports,
    stored: { refOf: plain, mapRef: plain, fileRef: () => Promise.resolve(null), release: () => undefined, floorMaps: (maps) => void reports.push(maps) },
  };
}

const seats: SeatSource = { onlinePlayers: () => [ANA, BEN], ownerOf: (id) => OWNERS[id], claimOf: (_map, id) => (OWNERS[id] === undefined ? null : 'taken') };

describe('the maps of the shared scene\'s floors, by who looks at them', () => {
  it('name the presented floor\'s, those of floors players stand on, and the others\'', () => {
    expect(floorMaps(scene('cellar'), new Map([[ANA, 'ground'], [BEN, 'cellar']]), 'ground')).toEqual({ presented: 'maps/ground.webp', watched: ['maps/cellar.webp'], rest: ['maps/vault.webp'] });
    expect(floorMaps(sceneState({ background: 'maps/only.webp' }), new Map([[ANA, null]]), null)).toEqual({ presented: 'maps/only.webp', watched: [], rest: [] });
  });

  it('are told again when a player walks to another floor and when another floor is presented', async () => {
    const { stored, reports } = storing();
    const table = shareHarness(scene('cellar'), IMAGES, seats, undefined, stored);
    table.presented = 'ground';
    table.share.start();
    await table.advance(1000);
    expect(reports.at(-1)).toEqual({ presented: 'maps/ground.webp', watched: ['maps/cellar.webp'], rest: ['maps/vault.webp'] });
    await table.set(scene('vault'));
    await table.advance(1000);
    expect(reports.at(-1)).toEqual({ presented: 'maps/ground.webp', watched: ['maps/vault.webp'], rest: ['maps/cellar.webp'] });
    table.presented = 'cellar';
    await table.advance(2000);
    expect(reports.at(-1)).toEqual({ presented: 'maps/cellar.webp', watched: ['maps/ground.webp', 'maps/vault.webp'], rest: [] });
  });
});

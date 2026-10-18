import { TFile } from 'obsidian';
import { afterEach, describe, expect, it } from 'vitest';
import { CampaignFiles } from '../../../../src/app/campaigns/CampaignFiles';
import { CAMPAIGNS_FOLDER } from '../../../../src/app/campaigns/campaignPaths';
import { CampaignPlayers } from '../../../../src/app/campaigns/players/CampaignPlayers';
import { withPlayer, type CampaignPlayer } from '../../../../src/app/campaigns/players/playersFile';
import { MAX_CAMPAIGN_PLAYERS } from '../../../../src/app/online/protocol/index.ts';
import { admitNewcomer, refusalText, TableSeats } from '../../../../src/app/online/gm/campaignSeats.ts';
import { createInMemoryApp } from '../../../mocks/inMemoryVault';

const FOLDER = `${CAMPAIGNS_FOLDER}/Witherwild`;
const campaignText = `${JSON.stringify({ format: 1, id: 'c1', name: 'Witherwild', createdAt: 1 })}\n`;
const ANA: CampaignPlayer = { id: 'a'.repeat(20), name: 'Ana', code: '000001', characters: ['lib-ana'] };
const NEW = { id: 'n'.repeat(20), name: 'Noor' };
/** A random source that draws these numbers in turn, then zeros. */
const seq = (...draws: number[]): (() => number) => () => draws.shift() ?? 0;

/** A player id for each number, in the relay's alphabet. */
const seatId = (index: number): string => `${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`.padStart(20, 'z');

const opened: ReturnType<typeof createInMemoryApp>[] = [];

async function campaign(files: Record<string, string> = {}): Promise<{ vault: ReturnType<typeof createInMemoryApp>; players: CampaignPlayers; seats: TableSeats }> {
  const vault = createInMemoryApp({ files: { [`${FOLDER}/campaign.json`]: campaignText, ...files } });
  opened.push(vault);
  await CampaignFiles.open(vault.app).load();
  const players = CampaignPlayers.open(vault.app);
  await players.whenLoaded();
  return { vault, players, seats: new TableSeats(players, 'c1') };
}

afterEach(() => {
  for (const vault of opened.splice(0)) {
    CampaignPlayers.release(vault.app);
    CampaignFiles.release(vault.app);
  }
});

describe('the seats of a campaign a table runs on', () => {
  it('are its players file: the players, their codes as the relay is told them, and who plays which character', async () => {
    const { players, seats } = await campaign();
    players.change('c1', (stored) => withPlayer(stored, ANA));
    expect(seats.players()).toEqual([ANA]);
    expect(seats.seats()).toEqual([{ id: ANA.id, name: 'Ana', code: '000001' }]);
    expect(seats.codeOf(ANA.id)).toBe('000001');
    expect(seats.codeOf(NEW.id)).toBeNull();
    seats.setOwner('lib-bear', ANA.id);
    expect(players.of('c1').players[0]?.characters).toEqual(['lib-ana', 'lib-bear']);
  });

  it('tell their listeners of every change of the campaign\'s file, and of no other campaign\'s', async () => {
    const other = `${CAMPAIGNS_FOLDER}/Moor`;
    const { vault, players, seats } = await campaign({ [`${other}/campaign.json`]: `${JSON.stringify({ format: 1, id: 'c2', name: 'Moor', createdAt: 1 })}\n` });
    await CampaignFiles.forApp(vault.app)?.load();
    let heard = 0;
    seats.onChange(() => (heard += 1));
    players.change('c1', (stored) => withPlayer(stored, ANA));
    expect(heard).toBe(1);
    players.change('c2', (stored) => withPlayer(stored, { ...ANA, id: NEW.id }));
    expect(heard).toBe(1);
    // Another device's write arrives as a change of the file.
    await players.flush();
    const path = `${FOLDER}/players.json`;
    const file = JSON.parse(vault.files.get(path) ?? '{}') as { players: Record<string, object> };
    file.players[NEW.id] = { name: 'Noor', code: '000002', characters: [], addedAt: 2 };
    await vault.app.vault.adapter.write(path, JSON.stringify(file));
    vault.emit('modify', new TFile(path));
    for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(heard).toBe(2);
    expect(seats.players().map((player) => player.name)).toEqual(['Ana', 'Noor']);
  });
});

describe('a newcomer admitted into the campaign', () => {
  it('gets a code no other player has and that is not the join code', async () => {
    const { seats } = await campaign();
    seats.change((stored) => withPlayer(stored, ANA));
    // The first draws are Ana's code and the join code.
    const admitted = admitNewcomer(seats, NEW, '000002', seq(1, 2, 3));
    expect(admitted).toEqual({ id: NEW.id, name: 'Noor', code: '000003', characters: [] });
    expect(seats.players().map((player) => player.code)).toEqual(['000001', '000003']);
  });

  it('is refused once the campaign has as many players as it may', async () => {
    const { seats } = await campaign();
    seats.change((stored) => Array.from({ length: MAX_CAMPAIGN_PLAYERS }, (_, index) => index).reduce(
      (file, index) => withPlayer(file, { id: seatId(index), name: `P${index}`, code: String(index).padStart(6, '0'), characters: [] }), stored,
    ));
    expect(seats.players()).toHaveLength(MAX_CAMPAIGN_PLAYERS);
    expect(admitNewcomer(seats, NEW, '999999')).toBeNull();
    expect(seats.players()).toHaveLength(MAX_CAMPAIGN_PLAYERS);
    expect(refusalText(seats, 'Noor')).toBe('The campaign has no room for Noor.');
  });

  it('is refused, and nothing written, where the players file is of a later format', async () => {
    const later = `${JSON.stringify({ format: 2, campaignId: 'c1', players: {} })}\n`;
    const { vault, players, seats } = await campaign({ [`${FOLDER}/players.json`]: later });
    expect(admitNewcomer(seats, NEW, '999999')).toBeNull();
    await players.flush();
    expect(vault.files.get(`${FOLDER}/players.json`)).toBe(later);
    expect(refusalText(seats, 'Noor')).toBe('This campaign\'s players file is from a newer Atlas.');
  });
});

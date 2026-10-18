// @vitest-environment node
import type { App } from 'obsidian';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignFiles } from '../../../../src/app/campaigns/CampaignFiles';
import { CampaignPlay } from '../../../../src/app/campaigns/campaignPlay';
import { CAMPAIGNS_FOLDER } from '../../../../src/app/campaigns/campaignPaths';
import { CampaignPlayers } from '../../../../src/app/campaigns/players/CampaignPlayers';
import { MAX_CAMPAIGN_PLAYERS } from '../../../../src/app/online/protocol/index.ts';
import { OnlineControl } from '../../../../src/app/online/gm/OnlineControl.ts';
import { Ownership, readOwnership } from '../../../../src/app/online/gm/ownership.ts';
import { appCampaigns } from '../../../../src/app/online/gm/tableCampaigns.ts';
import { createInMemoryApp } from '../../../mocks/inMemoryVault';
import { app as fakeApp, atlasTab, FakeSocket, workspace } from './fakeTable.ts';
import { sceneState } from './shareHarness.ts';
import { advanceSettled as advance } from './settled.ts';

const seen = vi.hoisted(() => ({
  notices: [] as string[],
  requests: [] as { readonly url?: string; readonly body?: string }[],
  created: { status: 201, json: null as unknown },
}));

vi.mock('obsidian', async (original) => ({
  ...(await original<object>()),
  Notice: class {
    constructor(text: string) {
      seen.notices.push(text);
    }
  },
  requestUrl: (request: { readonly url?: string; readonly body?: string }) => {
    seen.requests.push(request);
    return Promise.resolve(seen.created);
  },
}));

vi.mock('../../../../src/app/online/gm/gmMarks.ts', () => ({
  GmMarks: class {
    source(): null {
      return null;
    }
    showPlayers(): void {}
    showPlayerDrags(): void {}
    showPlayerCursors(): void {}
    dispose(): void {}
  },
}));

const FOLDER = `${CAMPAIGNS_FOLDER}/Witherwild`;
const PLAYERS = `${FOLDER}/players.json`;
const campaignText = `${JSON.stringify({ format: 1, id: 'c1', name: 'Witherwild', createdAt: 1 })}\n`;
const LINK = 'k'.repeat(26);
const ANA = 'a'.repeat(20);
const NOOR = 'n'.repeat(20);
const playersText = (players: Record<string, object> = { [ANA]: { name: 'Ana', code: '000001', characters: [], addedAt: 1 } }): string => `${JSON.stringify({ format: 1, campaignId: 'c1', link: LINK, players })}\n`;
const signedIn = { token: (): string | null => 'account-token', signedOutByServer: (): void => undefined, refresh: (): Promise<void> => Promise.resolve() };

type Frame = { readonly t: string; readonly to?: string; readonly id?: string; readonly players?: readonly { id: string; name: string; code: string }[]; readonly body?: { t: string; code?: string; first?: boolean } };

/** A player id for each number, in the relay's alphabet. */
const seatId = (index: number): string => `${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`.padStart(20, 'z');

const opened: App[] = [];

/** A vault with one campaign (and its players file when given), the GM signed in, playing it unless told not to, and an Atlas tab. */
async function gm(players: string | null = playersText(), play = true): Promise<{ online: OnlineControl; vault: ReturnType<typeof createInMemoryApp>; app: App; files: CampaignPlayers; leaf: ReturnType<typeof atlasTab>['leaf']; bound: [string | null, number][] }> {
  const vault = createInMemoryApp({ files: { [`${FOLDER}/campaign.json`]: campaignText, ...(players === null ? {} : { [PLAYERS]: players }) } });
  const app = { ...vault.app, workspace: fakeApp.workspace, plugins: (fakeApp as unknown as { plugins: unknown }).plugins } as unknown as App;
  opened.push(app);
  await CampaignFiles.open(app).load();
  // Opened as the plugin opens it; reading the file is left to whoever waits for it.
  const files = CampaignPlayers.open(app);
  if (play) CampaignPlay.forApp(app).play('c1');
  const tab = atlasTab(sceneState({ mapPath: 'Scenes/Cave.atlasmap' }));
  workspace.leaves = [tab.leaf];
  // Which campaign the books were bound to, and how many sockets were open by then.
  const bound: [string | null, number][] = [];
  const online = new OnlineControl(app, new Ownership(readOwnership(undefined), () => undefined), appCampaigns(app, (campaignId) => void bound.push([campaignId, FakeSocket.all.length])), undefined, signedIn);
  return { online, vault, app, files, leaf: tab.leaf, bound };
}

/** A table started for the campaign and welcomed by the relay with `connected` at it. */
async function hosting(players?: string, connected: readonly { id: string; name: string }[] = []): Promise<Awaited<ReturnType<typeof gm>> & { socket: FakeSocket; frames: () => Frame[] }> {
  const made = await gm(players);
  await made.online.start(made.leaf);
  await advance(0);
  const socket = FakeSocket.all.at(-1);
  if (socket === undefined) throw new Error('no socket');
  socket.relay({ t: 'welcome', role: 'gm', players: connected });
  await advance(100);
  return { ...made, socket, frames: () => socket.frames() as Frame[] };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('WebSocket', FakeSocket);
  FakeSocket.all = [];
  seen.notices.length = 0;
  seen.requests.length = 0;
  seen.created = { status: 201, json: { code: LINK, secret: 's'.repeat(43), maxPlayers: 12 } };
  workspace.presented = null;
});

afterEach(() => {
  for (const app of opened.splice(0)) {
    CampaignPlayers.release(app);
    CampaignFiles.release(app);
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a table of the played campaign', () => {
  it('waits for the players file, and asks the relay for the campaign\'s own link', async () => {
    const { online, vault, files, leaf, bound } = await gm();
    expect(files.isLoaded()).toBe(false);
    const table = await online.start(leaf);
    expect(table).not.toBeNull();
    expect(files.isLoaded()).toBe(true);
    expect(seen.requests.map((request) => request.body)).toEqual([`{"code":"${LINK}"}`]);
    await files.flush();
    expect([...vault.files.keys()].filter((path) => path.endsWith('players.json'))).toEqual([PLAYERS]);
    // The campaign's books are bound before the table's socket opens, and let go when it ends.
    expect(bound).toEqual([['c1', 0]]);
    online.stop();
    expect(bound.at(-1)?.[0]).toBeNull();
  });

  it('makes the campaign\'s link once, and keeps it in the players file', async () => {
    const { online, vault, files, leaf } = await gm(null);
    await online.start(leaf);
    await files.flush();
    const link = (JSON.parse(vault.files.get(PLAYERS) ?? '{}') as { link?: string }).link;
    expect(link).toMatch(/^[a-z2-7]{26}$/);
    expect(seen.requests.map((request) => request.body)).toEqual([`{"code":"${link}"}`]);
    online.stop();
  });

  it('is not started while no campaign is played: no request, and the GM is told', async () => {
    const { online, leaf } = await gm(playersText(), false);
    expect(await online.start(leaf)).toBeNull();
    expect(seen.requests).toEqual([]);
    expect(seen.notices).toEqual(['Play a campaign first.']);
  });

  it('is not started where the link belongs to another account', async () => {
    const { online, leaf } = await gm();
    seen.created = { status: 409, json: { error: 'link-taken' } };
    expect(await online.start(leaf)).toBeNull();
    expect(seen.notices).toEqual(['This campaign\'s link belongs to another account. Make a new link.']);
  });

  it('tells the relay the campaign\'s players right after the gates', async () => {
    const { frames, online } = await hosting();
    const after = frames().slice(frames().findIndex((frame) => frame.t === 'gate') + 1);
    expect(after[0]).toEqual({ v: 1, t: 'players', players: [{ id: ANA, name: 'Ana', code: '000001' }] });
    expect(online.players().map((player) => player.name)).toEqual(['Ana']);
    online.stop();
  });
});

describe('who joins the campaign\'s table', () => {
  it('is a player of the campaign told their own code, or a newcomer made one with a code of their own', async () => {
    const { socket, frames, online, files } = await hosting();
    socket.relay({ t: 'player-joined', id: ANA, name: 'Ana' });
    socket.relay({ t: 'player-joined', id: NOOR, name: 'Noor' });
    await advance(100);
    const noor = files.of('c1').players.find((player) => player.id === NOOR);
    expect(noor).toMatchObject({ name: 'Noor', characters: [] });
    expect(noor?.code).not.toBe('000001');
    expect(noor?.code).not.toBe(online.table?.gate.settings.code);
    const codes = frames().filter((frame) => frame.t === 'send' && frame.body?.t === 'your-code').map((frame) => [frame.to, frame.body]);
    expect(codes).toEqual([[ANA, { t: 'your-code', code: '000001', first: false }], [NOOR, { t: 'your-code', code: noor?.code, first: true }]]);
    // The relay knows the newcomer's code before they are told it.
    const told = frames().findIndex((frame) => frame.to === NOOR && frame.body?.t === 'your-code');
    const rosters = frames().slice(0, told).filter((frame) => frame.t === 'players');
    expect(rosters.at(-1)?.players?.map((player) => player.id)).toEqual([ANA, NOOR]);
    expect(online.ownership.nameOf(NOOR)).toBe('Noor');
    online.stop();
  });

  it('is turned away where the campaign has no room, and the GM is told', async () => {
    const full = Object.fromEntries(Array.from({ length: MAX_CAMPAIGN_PLAYERS }, (_, index) => [seatId(index), { name: `P${index}`, code: String(index + 1).padStart(6, '0'), characters: [] }]));
    const { socket, frames, online, files } = await hosting(playersText(full));
    socket.relay({ t: 'player-joined', id: NOOR, name: 'Noor' });
    await advance(100);
    expect(frames().at(-1)).toEqual({ v: 1, t: 'kick', id: NOOR });
    expect(seen.notices).toContain('The campaign has no room for Noor.');
    expect(files.of('c1').players).toHaveLength(MAX_CAMPAIGN_PLAYERS);
    online.stop();
  });

  it('is turned away where the players file is from a newer Atlas', async () => {
    const later = `${JSON.stringify({ format: 2, campaignId: 'c1', link: LINK, players: {} })}\n`;
    const { socket, frames, online } = await hosting(later);
    socket.relay({ t: 'player-joined', id: NOOR, name: 'Noor' });
    await advance(100);
    expect(frames().at(-1)).toEqual({ v: 1, t: 'kick', id: NOOR });
    expect(seen.notices).toContain('This campaign\'s players file is from a newer Atlas.');
    online.stop();
  });
});

describe('the GM\'s players', () => {
  it('get a new code that keeps them connected', async () => {
    const { frames, online } = await hosting(undefined, [{ id: ANA, name: 'Ana' }]);
    const before = frames().length;
    online.newPlayerCode(ANA);
    await advance(100);
    const code = online.playerCode(ANA);
    expect(code).not.toBe('000001');
    expect(code).not.toBe(online.table?.gate.settings.code);
    const sent = frames().slice(before);
    expect(sent.filter((frame) => frame.t === 'players')).toEqual([{ v: 1, t: 'players', players: [{ id: ANA, name: 'Ana', code }] }]);
    expect(sent.some((frame) => frame.t === 'kick')).toBe(false);
    expect(sent.find((frame) => frame.to === ANA)?.body).toEqual({ t: 'your-code', code, first: false });
    online.stop();
  });

  it('are removed from the campaign: the relay forgets them first, then they are kicked', async () => {
    const { frames, online, files } = await hosting(undefined, [{ id: ANA, name: 'Ana' }]);
    const before = frames().length;
    online.removeFromCampaign(ANA);
    await advance(100);
    expect(frames().slice(before).filter((frame) => frame.t !== 'send')).toEqual([{ v: 1, t: 'players', players: [] }, { v: 1, t: 'kick', id: ANA }]);
    expect(files.of('c1').players).toEqual([]);
    expect(online.players()).toEqual([]);
    online.stop();
  });

  it('are added and renamed by the GM, and the relay is told', async () => {
    const { frames, online } = await hosting();
    const cal = online.addPlayer('Cal');
    expect(cal?.id).toMatch(/^[a-z2-7]{20}$/);
    online.renamePlayer(ANA, 'Anna');
    await advance(100);
    expect(frames().filter((frame) => frame.t === 'players').at(-1)?.players?.map((player) => player.name).sort()).toEqual(['Anna', 'Cal']);
    // A name no player may have changes nothing.
    online.renamePlayer(ANA, '   ');
    expect(online.players().map((player) => player.name)).toEqual(['Anna', 'Cal']);
    online.stop();
  });

  it('keep their campaign while the GM plays another, and are nobody\'s once the table ends', async () => {
    const { online, app, files } = await hosting();
    CampaignPlay.forApp(app).play('c2');
    online.addPlayer('Cal');
    expect(files.of('c1').players.map((player) => player.name).sort()).toEqual(['Ana', 'Cal']);
    online.stop();
    expect(online.players()).toEqual([]);
    expect(online.playerCode(ANA)).toBeNull();
  });
});

describe('a new link', () => {
  it('replaces the campaign\'s link and starts the running table again on it', async () => {
    const { frames, online, files } = await hosting();
    await online.newLink();
    const link = files.of('c1').link;
    expect(link).not.toBe(LINK);
    expect(frames().at(-1)).toEqual({ v: 1, t: 'end' });
    expect(seen.requests.map((request) => request.body)).toEqual([`{"code":"${LINK}"}`, `{"code":"${link}"}`]);
    expect(online.table).not.toBeNull();
    online.stop();
  });
});

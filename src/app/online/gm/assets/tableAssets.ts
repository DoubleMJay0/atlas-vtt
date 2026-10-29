import { normalizePath, type App, type WorkspaceLeaf } from 'obsidian';
import type { GmMessage } from '../../protocol/index.ts';
import { showNotice } from '../../../ui/notice';
import type { Timers } from '../companionTimers.ts';
import { tabSourceOf } from '../presentedScene.ts';
import type { AssetSalt } from './assetSalt.ts';
import { stagedSceneAssets } from './assetGather.ts';
import { AssetPublisher } from './AssetPublisher.ts';
import { AssetStoreClient } from './storeClient.ts';

/** What a table needs of the account to keep assets in the store for players. */
export interface TableAssets {
  /** The account's token, or null while signed out. */
  token(): string | null;
  readonly salt: Pick<AssetSalt, 'soon' | 'ensure'>;
  /** The relay refused the token. */
  signedOutByServer(): void;
  /** Uploads came to rest: what the store holds may have changed. */
  settled(): void;
}

export interface TablePublisherDeps {
  readonly app: App;
  /** The relay's origin, where the store's routes are. */
  readonly origin: string;
  readonly assets: TableAssets;
  readonly timers: Timers;
  send(body: GmMessage, to?: string): void;
  sendLive(body: GmMessage, key: string, to?: string): void;
  /** The players connected now, and the time the socket's last keep-alive took. */
  connection(): { readonly players: number; readonly latencyMs: number | null };
  /** Assets handed to players can no longer be stored: what names them hands them again. */
  withdrawn(): void;
}

/** A table's publisher, reading the vault as Obsidian has it: bytes with `readBinary`, never decoded. */
export function tablePublisher(deps: TablePublisherDeps): AssetPublisher {
  const { app, assets } = deps;
  const fileOf = (path: string): ReturnType<App['vault']['getFileByPath']> => app.vault.getFileByPath(normalizePath(path));
  return new AssetPublisher({
    client: new AssetStoreClient(deps.origin, () => assets.token()),
    salt: assets.salt,
    timers: deps.timers,
    readFile: async (path) => {
      const file = fileOf(path);
      return file === null ? null : new Uint8Array(await app.vault.readBinary(file));
    },
    stat: (path) => {
      const file = fileOf(path);
      return file === null ? null : { mtime: file.stat.mtime, size: file.stat.size };
    },
    connection: () => deps.connection(),
    send: (body, to) => deps.send(body, to),
    sendLive: (body, key, to) => deps.sendLive(body, key, to),
    notify: (text) => showNotice(text),
    signedOutByServer: () => assets.signedOutByServer(),
    settled: () => assets.settled(),
    withdrawn: () => deps.withdrawn(),
  });
}

/**
 * Offers the scenes open in Atlas's map tabs ahead of their turn (ASD-41's last rank): each scene file
 * once while it stays open, the presented one left to the shares that hand it to players.
 */
export class OpenScenes {
  private readonly staged = new Set<string>();

  constructor(private readonly app: App, private readonly publisher: Pick<AssetPublisher, 'stage'>) {}

  /** Looks at the open map tabs again: a scene opened since is offered. */
  check(leaves: readonly WorkspaceLeaf[], presented: string | null): void {
    const open = new Set<string>();
    for (const leaf of leaves) for (const tab of tabSourceOf(leaf.view)?.getState().tabs ?? []) open.add(tab.filePath);
    for (const path of [...this.staged]) if (!open.has(path)) this.staged.delete(path);
    for (const path of open) {
      if (path === presented || this.staged.has(path)) continue;
      this.staged.add(path);
      void stagedSceneAssets(this.app, path).then((assets) => this.publisher.stage(assets));
    }
  }
}

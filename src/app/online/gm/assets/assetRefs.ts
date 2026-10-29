import { ASSET_CAPS, type AssetRef } from '../../protocol/index.ts';
import { TILE_SPEC } from '../../../pixi/mapImage/pyramid';
import type { PyramidFacts } from '../../../pixi/mapImage/tileBlobs';
import { ASSET_RANKS, ASSET_USES, type AssetStoring, type AssetUse } from './assetUses.ts';
import type { FileHashes, FileStat } from './fileHashes.ts';
import { MAP_CENTRE, planPyramid, type MapFocus } from './pyramidPlan.ts';
import type { TileBlobs } from './pyramidUpload.ts';
import type { AssetSource } from './uploadQueue.ts';

/** This device's map pyramids as the publisher reads them. */
export interface PyramidSource {
  /** The complete pyramid of the map image at a path, built first where the cache lacks it; null where none can be. */
  ensure(path: string): Promise<PyramidFacts | null>;
  readonly blobs: TileBlobs;
  /** Where players look on the shared map now, as shares of it; null: its centre. */
  focus?(): MapFocus | null;
}

/** An asset as the publisher notes it: what its id is made of, what it is, where its bytes are read, and whether players were handed it. */
export interface Registration {
  /** What the id is worked out of: the content hash, and for a pyramid the hash with its tile spec. */
  readonly key: string;
  readonly hash: string;
  readonly size: number;
  readonly mime: string;
  readonly use: AssetUse;
  readonly source: AssetSource;
  readonly handed: boolean;
}

export interface AssetRefsDeps {
  readonly hashes: FileHashes;
  readFile(path: string): Promise<Uint8Array<ArrayBuffer> | null>;
  stat(path: string): FileStat | null;
  readonly pyramids?: PyramidSource | undefined;
  /** Notes an asset; its id, or undefined where the store will not keep it. */
  register(asset: Registration): Promise<string | undefined>;
  /** Whether the store takes no pyramids (a relay without them): maps then go as images. */
  tilesRefused(): boolean;
}

/** A pyramid's id is worked out of the image's hash with its tile spec, so it is never the id of the image itself. */
export const pyramidKey = (hash: string, spec: number): string => `${hash}/tiles/${spec}`;

/** A pyramid pages can draw: this tile spec, decoded at full size, of the image itself. */
const drawable = (facts: PyramidFacts | null, hash: string): facts is PyramidFacts => facts !== null && facts.hash === hash && facts.spec === TILE_SPEC && facts.decodedScale === 1;

/** The references players are handed (`AssetStoring`), and the assets of the scenes open beside the presented one. */
export class AssetRefs implements AssetStoring {
  constructor(private readonly deps: AssetRefsDeps) {}

  async refOf(bytes: Uint8Array<ArrayBuffer>, mime: string, use: AssetUse, path?: string): Promise<AssetRef | null> {
    const hash = await this.deps.hashes.of(bytes, path);
    const id = await this.deps.register({ key: hash, hash, size: bytes.length, mime, use, source: path === undefined ? { bytes } : { path }, handed: true });
    return id === undefined ? null : { hash, size: bytes.length, mime, id };
  }

  async fileRef(path: string, mime: string, use: AssetUse): Promise<AssetRef | null> {
    const stat = this.deps.stat(path);
    if (stat === null || stat.size > ASSET_CAPS[use.kind]) return null;
    let hash = this.deps.hashes.kept(path);
    if (hash === undefined) {
      const bytes = await this.deps.readFile(path).catch(() => null);
      if (bytes === null) return null;
      hash = await this.deps.hashes.of(bytes, path);
    }
    const { size } = stat;
    const id = await this.deps.register({ key: hash, hash, size, mime, use, source: { path }, handed: true });
    return id === undefined ? null : { hash, size, mime, id };
  }

  async mapRef(bytes: Uint8Array<ArrayBuffer>, mime: string, path: string): Promise<AssetRef | null> {
    const pyramid = await this.pyramid(await this.deps.hashes.of(bytes, path), mime, path, ASSET_RANKS.map, true);
    return pyramid ?? this.refOf(bytes, mime, ASSET_USES.map, path);
  }

  /** Offers the images of a scene players may be shown next: maps as pyramids where they can be, uploaded last, never named to players. */
  async stage(assets: readonly { readonly path: string; readonly mime: string; readonly use: AssetUse; readonly map?: boolean }[]): Promise<void> {
    for (const asset of assets) {
      const stat = this.deps.stat(asset.path);
      if (stat === null) continue;
      const bytes = stat.size > ASSET_CAPS.image && asset.map !== true ? null : await this.deps.readFile(asset.path).catch(() => null);
      if (bytes === null) continue;
      const hash = await this.deps.hashes.of(bytes, asset.path);
      if (asset.map === true && (await this.pyramid(hash, asset.mime, asset.path, asset.use.rank, false)) !== undefined) continue;
      await this.deps.register({ key: hash, hash, size: bytes.length, mime: asset.mime, use: asset.use, source: { path: asset.path }, handed: false });
    }
  }

  /** A map's pyramid noted for upload, as players are handed it; undefined where it goes as an image. */
  private async pyramid(hash: string, mime: string, path: string, rank: number, handed: boolean): Promise<AssetRef | undefined> {
    const { pyramids } = this.deps;
    if (pyramids === undefined || this.deps.tilesRefused()) return undefined;
    const facts = await pyramids.ensure(path).catch(() => null);
    if (!drawable(facts, hash)) return undefined;
    const plan = planPyramid(facts, pyramids.focus?.() ?? MAP_CENTRE);
    const id = await this.deps.register({ key: pyramidKey(hash, facts.spec), hash, size: plan.bytes, mime, use: { kind: 'tiles', rank }, source: { plan }, handed });
    return id === undefined ? undefined : { hash, size: plan.bytes, mime, id, tiles: true };
  }
}

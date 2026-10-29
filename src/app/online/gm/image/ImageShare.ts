import { ASSET_CAPS, IMAGE_MIME_TYPES, isSide, MAX_ASSET_BYTES, parsePlayerMessage, type GmMessage, type ShownImage, type ShownImageRef } from '../../protocol/index.ts';
import { imageDimensions } from '../../../imageProcessing/imageDimensions';
import { AssetAnswers } from '../assetAnswers.ts';
import { sha256Hex } from '../assetServe.ts';
import type { ScaleImage } from '../assetVariants.ts';
import { ASSET_USES, type AssetStoring } from '../assets/assetUses.ts';
import type { VaultImage } from '../TokenShare.ts';

export interface ImageSharePorts {
  send(body: GmMessage, to?: string): void;
  now(): number;
  /** A new showing's id: 24 hex characters from the cryptographic source. */
  randomId(): string;
  /** Scales the image for a player who asks for a longest side; without it players get the original only. */
  scaleImage?: ScaleImage | undefined;
  /** An image is shown now, or none any more: the GM's control says so. */
  changed(): void;
  /** Takes a showing into the table's log, with its file's vault path (the GM's alone). */
  logShown?(shown: ShownImageRef, path: string | null): void;
  /** The vault path of a shown image the table's log holds, by hash: players may be sent it while it does. */
  loggedFile?(hash: string): string | undefined;
  readImage?(path: string): Promise<VaultImage | null>;
  /** How players are handed images the store keeps for them; without it they fetch the image from the GM. */
  stored?: AssetStoring | undefined;
}

/** The most recent showings whose bytes are kept, so the log serves them as they were sent (an SVG drawn to a PNG may not draw alike again). */
const KEPT_SHOWINGS = 6;

/** How a showing went: shown, replaced by what the GM asked for meanwhile, or why players cannot be sent the image. */
export type ShowResult = 'shown' | 'replaced' | 'too-large' | 'unreadable';

/**
 * The image the GM shows every player over the map ("Display on player view"). It is the table's,
 * not a scene's: it stays until the GM takes it away or shows another, and goes again to a player
 * who joins and to all after a reconnect. Players get the image only, by hash, with a new id for
 * every showing and its own size, never its file's name or path. Its bytes are served to whoever
 * asks while it is shown, larger than a longest side asked for as a scaled copy; a GIF always goes
 * as it is, since a copy would hold its first frame only.
 */
export class ImageShare {
  private readonly ports: ImageSharePorts;
  private current: { readonly shown: ShownImage; readonly bytes: Uint8Array<ArrayBuffer> } | null = null;
  /** Counts what the GM asked for: an image still being read or hashed when the next comes, or a dismissal, is not shown. */
  private turn = 0;
  private readonly answers: AssetAnswers;
  private readonly kept = new Map<string, Uint8Array>();

  constructor(ports: ImageSharePorts) {
    this.ports = ports;
    const scale = ports.scaleImage;
    this.answers = new AssetAnswers({
      send: (body, to) => ports.send(body, to),
      now: () => ports.now(),
      readImage: (path) => ports.readImage?.(path) ?? Promise.resolve(null),
      scaleImage: scale === undefined ? undefined : (bytes, mime, maxSide) => (mime === 'image/gif' ? Promise.resolve(null) : scale(bytes, mime, maxSide)),
    }, {
      map: () => (this.current === null ? null : { hash: this.current.shown.image.hash, bytes: this.current.bytes, mime: this.current.shown.image.mime }),
      // An image shown before is served while the log holds it: as it was sent, else read again from its file.
      explored: (hash) => (ports.loggedFile?.(hash) === undefined ? undefined : this.kept.get(hash)),
      artPath: (hash) => ports.loggedFile?.(hash),
    });
  }

  /** Whether players are shown an image now. */
  get isShown(): boolean {
    return this.current !== null;
  }

  /**
   * Shows the image `read` gives to every player, in place of the one shown, and logs it with the
   * file's `path`. The last one asked for wins, however long each takes to read: the turn is taken
   * before the read begins.
   */
  async show(read: () => Promise<VaultImage | null>, path: string | null = null): Promise<ShowResult> {
    const turn = (this.turn += 1);
    const image = await read().catch(() => null);
    if (image === null) return 'unreadable';
    // Larger than the store keeps, or than the GM serves itself where nothing is stored.
    if (image.bytes.length > (this.ports.stored === undefined ? MAX_ASSET_BYTES : ASSET_CAPS.image)) return 'too-large';
    if (!IMAGE_MIME_TYPES.includes(image.mime)) return 'unreadable';
    const size = await imageDimensions(new Blob([image.bytes], { type: image.mime })).catch(() => null);
    if (size === null || !isSide(size.width) || !isSide(size.height)) return 'unreadable';
    // Kept, not read again for the upload: an SVG reaches players as a PNG drawn here.
    const ref = this.ports.stored === undefined ? { hash: await sha256Hex(image.bytes), size: image.bytes.length, mime: image.mime } : await this.ports.stored.refOf(image.bytes, image.mime, ASSET_USES.image);
    if (ref.id === undefined && image.bytes.length > MAX_ASSET_BYTES) return 'too-large';
    if (turn !== this.turn) return 'replaced';
    this.current = { shown: { id: this.ports.randomId(), image: ref, width: size.width, height: size.height }, bytes: image.bytes };
    this.keep(ref.hash, image.bytes);
    this.resend();
    this.ports.logShown?.({ image: this.current.shown.image, width: size.width, height: size.height }, path);
    this.ports.changed();
    return 'shown';
  }

  /**
   * The shown image's reference again, as it can be sent now: one the store no longer keeps goes
   * without its id, so players ask the GM for it.
   */
  async refreshAssets(): Promise<void> {
    const shown = this.current;
    const stored = this.ports.stored;
    if (shown === null || stored === undefined || shown.shown.image.id === undefined) return;
    const ref = await stored.refOf(shown.bytes, shown.shown.image.mime, ASSET_USES.image);
    if (this.current !== shown || ref.id === shown.shown.image.id) return;
    if (ref.id === undefined && shown.bytes.length > MAX_ASSET_BYTES) return void this.dismiss();
    this.current = { shown: { ...shown.shown, image: ref }, bytes: shown.bytes };
    this.resend();
  }

  /** Takes the image away from every player; false when none was shown. */
  dismiss(): boolean {
    this.turn += 1;
    if (this.current === null) return false;
    this.current = null;
    this.resend();
    this.ports.changed();
    return true;
  }

  /** What is shown, or that nothing is, to one player or to all; sent to all, the image may be asked for again at once. */
  resend(to?: string): void {
    if (to === undefined) this.answers.forget();
    this.ports.send({ t: 'shown-image', shown: this.current?.shown ?? null }, to);
  }

  /** A player's message: true when it asked for the shown image, or one the log holds, which is then served. */
  receive(from: string, body: unknown): boolean {
    const message = parsePlayerMessage(body);
    if (message?.t !== 'asset-request' || (message.hash !== this.current?.shown.image.hash && this.ports.loggedFile?.(message.hash) === undefined)) return false;
    this.answers.answer(from, message);
    return true;
  }

  private keep(hash: string, bytes: Uint8Array): void {
    this.kept.delete(hash);
    this.kept.set(hash, bytes);
    for (const old of this.kept.keys()) if (this.kept.size > KEPT_SHOWINGS) this.kept.delete(old);
  }

  /** A player left the table: chunks queued for them are dropped, so they may ask again at once. */
  playerLeft(player: string): void {
    this.answers.forget(player);
  }
}

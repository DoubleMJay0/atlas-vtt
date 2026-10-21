import { CanvasSource, Texture } from 'pixi.js';
import { getDomHost } from '../../../host/dom';
import { glowAlphaAt, glowTextureSize, type GlowExtent } from './turnMarkerShape';

/** Samples of the glow's profile from the middle to the edge, read for every texel by its distance. */
const PROFILE_SAMPLES = 2048;

/** A small fixed noise per texel, under half a step of the 8-bit alpha, so the soft falloff shows no bands. */
function dither(x: number, y: number): number {
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return hash - Math.floor(hash) - 0.5;
}

/** The glow in white (tinted per marker), `size` texels across, with mipmaps for a map zoomed out; null without a 2D canvas. */
function paintGlow(size: number, extent: Pick<GlowExtent, 'edgeShare' | 'unitShare' | 'spread'>): Texture | null {
  const canvas = getDomHost().createCanvas(undefined, { width: size, height: size });
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const profile = new Float32Array(PROFILE_SAMPLES + 1);
  for (let index = 0; index <= PROFILE_SAMPLES; index += 1) profile[index] = glowAlphaAt(index / PROFILE_SAMPLES, extent);
  const image = context.createImageData(size, size);
  const half = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const share = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      if (share >= 1) continue;
      const alpha = profile[Math.round(share * PROFILE_SAMPLES)]!;
      if (alpha <= 0) continue;
      const offset = 4 * (y * size + x);
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = Math.min(255, Math.max(0, Math.round(alpha * 255 + dither(x, y))));
    }
  }
  context.putImageData(image, 0, 0);
  return new Texture({ source: new CanvasSource({ resource: canvas, autoGenerateMipmaps: true, scaleMode: 'linear', label: 'turnGlow' }) });
}

interface Held {
  readonly texture: Texture | null;
  users: number;
}

/** Paints the glow for a texture `size` texels across; null where it cannot. */
export type GlowPainter = (size: number, extent: Pick<GlowExtent, 'edgeShare' | 'unitShare' | 'spread'>) => Texture | null;

/** How many glows no marker holds stay painted, so the turn passing between tokens of a few sizes paints none again. */
const IDLE_LIMIT = 4;

/**
 * The glow textures the markers show, one per shape (a token's size on the grid) and shared by
 * every marker of that shape: a side of look-alikes paints one. A glow no marker holds stays for
 * the next few shapes (`IDLE_LIMIT`), and goes when more are let go after it or on `destroy`.
 * Painting a large glow takes tens of milliseconds, which would fall on the turn's change.
 */
export class TurnGlowTextures {
  private readonly held = new Map<string, Held>();
  /** Glows no marker holds, the least recently let go first. */
  private readonly idle = new Map<string, Texture | null>();

  constructor(private readonly paint: GlowPainter = paintGlow) {}

  /** The texture for a glow of `extent`, held until `release(key)`; its key names it. */
  take(extent: GlowExtent): { key: string; texture: Texture | null } {
    const size = glowTextureSize(extent.radius);
    const key = `${size}|${extent.edgeShare.toFixed(4)}|${extent.unitShare.toFixed(5)}|${extent.spread.toFixed(3)}`;
    let entry = this.held.get(key);
    if (!entry) {
      const kept = this.idle.has(key);
      entry = { texture: kept ? this.idle.get(key) ?? null : this.paint(size, extent), users: 0 };
      this.idle.delete(key);
      this.held.set(key, entry);
    }
    entry.users += 1;
    return { key, texture: entry.texture };
  }

  release(key: string): void {
    const entry = this.held.get(key);
    if (!entry) return;
    entry.users -= 1;
    if (entry.users > 0) return;
    this.held.delete(key);
    this.idle.set(key, entry.texture);
    for (const [oldest, texture] of this.idle) {
      if (this.idle.size <= IDLE_LIMIT) break;
      this.idle.delete(oldest);
      texture?.destroy(true);
    }
  }

  destroy(): void {
    for (const entry of this.held.values()) entry.texture?.destroy(true);
    for (const texture of this.idle.values()) texture?.destroy(true);
    this.held.clear();
    this.idle.clear();
  }
}

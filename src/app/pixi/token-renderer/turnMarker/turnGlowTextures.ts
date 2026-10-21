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

/**
 * The glow textures the markers show, one per shape (a token's size on the grid) and shared by
 * every marker of that shape: a side of look-alikes paints one. A texture goes once no marker
 * holds it.
 */
export class TurnGlowTextures {
  private readonly held = new Map<string, Held>();

  /** The texture for a glow of `extent`, held until `release(key)`; its key names it. */
  take(extent: GlowExtent): { key: string; texture: Texture | null } {
    const size = glowTextureSize(extent.radius);
    const key = `${size}|${extent.edgeShare.toFixed(4)}|${extent.unitShare.toFixed(5)}|${extent.spread.toFixed(3)}`;
    let entry = this.held.get(key);
    if (!entry) {
      entry = { texture: paintGlow(size, extent), users: 0 };
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
    entry.texture?.destroy(true);
  }

  destroy(): void {
    for (const entry of this.held.values()) entry.texture?.destroy(true);
    this.held.clear();
  }
}

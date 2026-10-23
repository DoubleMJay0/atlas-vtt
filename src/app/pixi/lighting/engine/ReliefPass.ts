import { Mesh, UniformGroup, type Geometry, type RenderTexture, type Shader } from 'pixi.js';
import { chordOffsets } from '../../../lighting/chordOffsets';
import { RELIEF } from '../../../lighting/lightingConstants';
import type { Rect } from '../../../lighting/segments';
import { ENGINE_SHADERS } from './engineShaders';
import { createShader, createTarget } from './gpu';
import type { EngineRelief } from './ReliefMap';

/**
 * A tile's relief shadow: traced on a grid of its own over the tile's rect, no finer than a texel of
 * the relief or of the tile, into one of the pass's targets (`reliefPointFragment`,
 * `reliefAreaFragment`).
 */
export interface ReliefJob {
  readonly relief: EngineRelief;
  /** World rect: the tile's corner, whole texels of the shadow's grid past its far side. */
  readonly rect: Rect;
  readonly texels: readonly [number, number];
  /** One of the pass's targets, taken at the job's first step. */
  raw: RenderTexture | null;
}

/** What the relief pass draws with that the tracer owns: its quad, its tile's uniforms and an area light's, and a placeholder to bind. */
export interface ReliefPassParts {
  geometry: Geometry;
  tileUniforms: UniformGroup;
  areaUniforms: UniformGroup;
  placeholder: RenderTexture;
}

/**
 * The shadows of what stands (`EngineRelief`) in a light's tile (`TileTracer`): traced after the
 * walls' into a target of its own, which the smoothing then multiplies the tile by
 * (`RELIEF_SHADOW_GLSL`, through `uniforms` and `uReliefShadow`). Its two targets are used in turn
 * with the tracer's raw ones and freed with them.
 */
export class ReliefPass {
  /** The relief and where a tile's shadow lies, read by the passes and by the smoothing. */
  readonly uniforms = new UniformGroup({
    uHasRelief: { value: 0, type: 'f32' },
    uReliefRect: { value: new Float32Array(4), type: 'vec4<f32>' },
    uReliefTexels: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
    uWorldToRelief: { value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), type: 'mat3x3<f32>' },
    uReliefSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uReliefOffsets: { value: new Float32Array(chordOffsets(RELIEF.rays)), type: 'f32', size: RELIEF.rays },
  });
  /** What stands on the map, whose shadows each tile begun from now on takes; none, and tiles are as they were without reliefs. */
  relief: EngineRelief | null = null;
  private readonly point: Mesh<Geometry, Shader>;
  private readonly area: Mesh<Geometry, Shader>;
  private readonly raws: (RenderTexture | null)[] = [null, null];

  constructor(private readonly parts: ReliefPassParts) {
    const reads = { reliefUniforms: this.uniforms, uRelief: parts.placeholder.source, uReliefBlocks: parts.placeholder.source };
    this.point = new Mesh({ geometry: parts.geometry, shader: createShader(ENGINE_SHADERS.reliefPoint, { tileUniforms: parts.tileUniforms, ...reads }) });
    this.area = new Mesh({ geometry: parts.geometry, shader: createShader(ENGINE_SHADERS.reliefArea, { tileUniforms: parts.tileUniforms, areaUniforms: parts.areaUniforms, uDistance: parts.placeholder.source, ...reads }) });
  }

  /** The relief shadow of a tile over `rect` on a light map of `texel` world pixels, while there is a relief. */
  job(rect: Rect, texel: number): ReliefJob | null {
    const { relief } = this;
    if (!relief) return null;
    const step = Math.max(texel, relief.texelWorld);
    const texels: [number, number] = [Math.max(1, Math.ceil(rect[2] / step)), Math.max(1, Math.ceil(rect[3] / step))];
    return { relief, rect: [rect[0], rect[1], texels[0] * step, texels[1] * step], texels, raw: null };
  }

  /** The mesh that draws a job's shadow: a point light's, or an area light's. */
  mesh(area: boolean): Mesh<Geometry, Shader> {
    return area ? this.area : this.point;
  }

  /** Gives `job` turn `turn`'s target, at least its size. */
  take(job: ReliefJob, turn: number): void {
    const [width, height] = job.texels;
    const raw = this.raws[turn];
    const current = raw?.source;
    if (raw && current && current.pixelWidth >= width && current.pixelHeight >= height) {
      job.raw = raw;
      return;
    }
    const grown = createTarget(Math.max(width, current?.pixelWidth ?? 0), Math.max(height, current?.pixelHeight ?? 0), 'r8unorm', 'linear');
    raw?.destroy(true);
    this.raws[turn] = grown;
    job.raw = grown;
  }

  /**
   * Binds `job` (null: none, and the smoothing writes what it did before reliefs) to its passes and
   * its target to `smooth`; an area light's passes read `distance`, its exact field.
   */
  bind(job: ReliefJob | null, distance: RenderTexture | null, smooth: Shader): void {
    const u = this.uniforms.uniforms;
    u.uHasRelief = job ? 1 : 0;
    if (!job?.raw) return;
    const target = job.raw.source;
    u.uReliefRect.set(job.rect);
    u.uReliefTexels.set([job.texels[0], job.texels[1], target.pixelWidth, target.pixelHeight]);
    u.uWorldToRelief.set(job.relief.worldToRelief);
    u.uReliefSize.set([job.relief.width, job.relief.height]);
    for (const mesh of [this.point, this.area]) {
      mesh.shader!.resources.uRelief = job.relief.heights.source;
      mesh.shader!.resources.uReliefBlocks = job.relief.blocks.source;
    }
    if (distance) this.area.shader!.resources.uDistance = distance.source;
    smooth.resources.uReliefShadow = target;
  }

  /** Nothing of a relief stays bound: its owner may destroy it, and the targets go with `release`. */
  unbind(smooth: Shader): void {
    const empty = this.parts.placeholder.source;
    for (const mesh of [this.point, this.area]) {
      mesh.shader!.resources.uRelief = empty;
      mesh.shader!.resources.uReliefBlocks = empty;
    }
    this.area.shader!.resources.uDistance = empty;
    smooth.resources.uReliefShadow = empty;
  }

  /** Frees the targets; the next job allocates them again. */
  release(): void {
    for (let i = 0; i < this.raws.length; i++) {
      this.raws[i]?.destroy(true);
      this.raws[i] = null;
    }
  }

  destroy(): void {
    for (const mesh of [this.point, this.area]) {
      mesh.shader?.destroy();
      mesh.destroy();
    }
    this.release();
  }
}

import { Mesh, UniformGroup, type Geometry, type Renderer, type RenderTexture, type Shader } from 'pixi.js';
import { chordOffsets } from '../../../lighting/chordOffsets';
import { LIGHT_LEVELS, TILE_BAND_TEXELS, TILE_RAYS } from '../../../lighting/lightingConstants';
import { AREA_CORNER_VECTORS } from './areaTileShader';
import type { Rect } from '../../../lighting/segments';
import type { EngineRelief } from './ReliefMap';
import { ReliefPass, type ReliefJob } from './ReliefPass';
import { CapsuleField } from './CapsuleField';
import { ENGINE_SHADERS } from './engineShaders';
import { createPlaceholder, createQuad, createShader, createTarget, destroyQuad, glOf, quadGeometry, renderInto, type Quad } from './gpu';

export interface TileTracerOptions {
  /** Rays across the flame where a texel sees part of it, 1 to `TILE_RAYS` (`LightingQuality.tileRays`). */
  rays?: number;
  /** Most texels one draw covers (`TILE_BAND_TEXELS`); tests compare against a single draw. */
  bandTexels?: number;
}

/**
 * One light's tile being built: traced into a raw target, then smoothed into `tile`, one band of
 * rows after another (`TileTracer.step`). Once stepped, a job is finished or dropped before
 * another is stepped; the caller owns `oneWay` and, once done, `tile`.
 */
export interface TileJob {
  readonly at: readonly [number, number];
  readonly flame: number;
  readonly rect: Rect;
  readonly oneWay: CapsuleField | null;
  readonly tile: RenderTexture;
  /** An area light's tile: its outline is drawn into a distance field first, then traced towards. */
  readonly area?: AreaJob;
  /** The shadows of what stands (`EngineRelief`), traced after the walls' and taken into the smoothing; none without a relief. */
  readonly relief: ReliefJob | null;
  /** One of the tracer's raw targets, taken at the first step. */
  raw: RenderTexture | null;
  phase: 'distance' | 'trace' | 'relief' | 'blurX' | 'blurY' | 'smooth' | 'done';
  /** The next row of the current pass to draw. */
  row: number;
}

/** What an area light's tile is traced from: its outline and how its light falls off from it, in world pixels. */
export interface AreaJob {
  readonly corners: Float32Array;
  readonly count: number;
  readonly bright: number;
  readonly dim: number;
  /** Where its light ends (`LIGHT_REACH` of its dim range). */
  readonly reach: number;
  /** Sigma, in world pixels, of the blur that rounds the creases of its distance field for the light map (`areaBlurFragment`). */
  readonly blur: number;
  /** The signed distance to the outline on the tile's texel grid (`r16float`); the caller owns it once the job is done. */
  readonly distance: RenderTexture;
}

/** An area light as `beginArea` takes it. */
export interface AreaLightShape {
  corners: readonly { x: number; y: number }[];
  bright: number;
  dim: number;
  reach: number;
  blur: number;
}

/**
 * Traces one light's visibility tile (`r8unorm`, one texel per field texel) through the wall
 * field, then smooths it within the free space around each texel (`tileSmoothShader.ts`).
 * Both passes draw in bands of whole rows, so no single draw runs long on a slow device, and a
 * tile can be built over several frames (`begin`, `step`).
 */
export class TileTracer {
  private readonly uniforms = new UniformGroup({
    uTileRect: { value: new Float32Array(4), type: 'vec4<f32>' },
    uLight: { value: new Float32Array(2), type: 'vec2<f32>' },
    uFlame: { value: 1, type: 'f32' },
    uRays: { value: TILE_RAYS, type: 'f32' },
    uOffsets: { value: new Float32Array(TILE_RAYS), type: 'f32', size: TILE_RAYS },
    uTexel: { value: 1, type: 'f32' },
    uHasOneWay: { value: 0, type: 'f32' },
    uExtent: { value: new Float32Array(2), type: 'vec2<f32>' },
    uBand: { value: new Float32Array([0, 1]), type: 'vec2<f32>' },
    uTexels: { value: new Float32Array(2), type: 'vec2<f32>' },
  });
  /** An area light's outline and falloff (`areaTileShader.ts`). */
  private readonly areaUniforms = new UniformGroup({
    uCorners: { value: new Float32Array(AREA_CORNER_VECTORS * 4), type: 'vec4<f32>', size: AREA_CORNER_VECTORS },
    uCount: { value: 0, type: 'i32' },
    uAreaBright: { value: 0, type: 'f32' },
    uAreaDim: { value: 0, type: 'f32' },
    uAreaReach: { value: 1, type: 'f32' },
    uBrightLevel: { value: LIGHT_LEVELS.bright, type: 'f32' },
    uDimLevel: { value: LIGHT_LEVELS.dim, type: 'f32' },
  });
  private readonly blurUniforms = new UniformGroup({
    uStep: { value: new Float32Array([1, 0]), type: 'vec2<f32>' },
    uSigma: { value: 1, type: 'f32' },
  });
  private readonly bandTexels: number;
  private readonly shader: Shader;
  private readonly blurShader: Shader;
  private readonly smoothShader: Shader;
  private readonly distanceShader: Shader;
  private readonly areaShader: Shader;
  private readonly quad: Quad = createQuad();
  private readonly geometry: Geometry = quadGeometry(this.quad);
  private readonly mesh: Mesh<Geometry, Shader>;
  private readonly smoothMesh: Mesh<Geometry, Shader>;
  private readonly distanceMesh: Mesh<Geometry, Shader>;
  private readonly areaMesh: Mesh<Geometry, Shader>;
  private readonly blurMesh: Mesh<Geometry, Shader>;
  /** The shadows of what stands, traced after the walls' (`ReliefPass`). */
  private readonly relief: ReliefPass;
  /** The first direction of an area light's blur, freed by `release` like the raw targets. */
  private blurScratch: RenderTexture | null = null;
  /** Bound as the smoothing input between traces, so the program never keeps a raw target. */
  private readonly placeholder: RenderTexture = createPlaceholder();
  /** Bound when a light has no one-way walls, so the program always has both fields. */
  private readonly noOneWay: CapsuleField;
  private noOneWayBuilt = false;
  /**
   * The raw traces' targets, used in turn so a trace never waits for the previous tile's
   * smoothing to finish reading; freed by `release`, grown to the largest tile each held.
   */
  private readonly raws: (RenderTexture | null)[] = [null, null];
  private turn = 0;

  constructor(private readonly renderer: Renderer, private readonly field: CapsuleField, options: TileTracerOptions = {}) {
    const rays = Math.min(TILE_RAYS, Math.max(1, Math.round(options.rays ?? TILE_RAYS)));
    this.uniforms.uniforms.uRays = rays;
    this.uniforms.uniforms.uOffsets.set(chordOffsets(rays));
    this.bandTexels = options.bandTexels ?? TILE_BAND_TEXELS;
    this.noOneWay = new CapsuleField(renderer, [0, 0, 1, 1], 1, 0, 'uOneWay');
    const resources = { tileUniforms: this.uniforms, ...field.resources(), ...this.noOneWay.resources() };
    this.relief = new ReliefPass({ geometry: this.geometry, tileUniforms: this.uniforms, areaUniforms: this.areaUniforms, placeholder: this.placeholder });
    this.shader = createShader(ENGINE_SHADERS.tile, resources);
    this.smoothShader = createShader(ENGINE_SHADERS.tileSmooth, { ...resources, uRaw: this.placeholder.source, reliefUniforms: this.relief.uniforms, uReliefShadow: this.placeholder.source });
    this.distanceShader = createShader(ENGINE_SHADERS.areaDistance, { tileUniforms: this.uniforms, areaUniforms: this.areaUniforms });
    this.areaShader = createShader(ENGINE_SHADERS.areaTile, { ...resources, areaUniforms: this.areaUniforms, uDistance: this.placeholder.source });
    this.blurShader = createShader(ENGINE_SHADERS.areaBlur, { tileUniforms: this.uniforms, blurUniforms: this.blurUniforms, uSource: this.placeholder.source });
    this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader });
    this.blurMesh = new Mesh({ geometry: this.geometry, shader: this.blurShader });
    this.smoothMesh = new Mesh({ geometry: this.geometry, shader: this.smoothShader });
    this.distanceMesh = new Mesh({ geometry: this.geometry, shader: this.distanceShader });
    this.areaMesh = new Mesh({ geometry: this.geometry, shader: this.areaShader });
  }

  /**
   * The relief whose shadows the tiles begun from now on take; null, none. The caller owns it and
   * rebuilds every tile when it changes (`TileCache.setRelief`); a job begun before keeps its own.
   */
  setRelief(relief: EngineRelief | null): void {
    this.relief.relief = relief;
  }

  /** The whole tile at once. `rect` must be snapped to the field's texel grid; `oneWay` holds this light's one-way walls. */
  trace(at: readonly [number, number], flame: number, rect: Rect, oneWay: CapsuleField | null): RenderTexture {
    const job = this.begin(at, flame, rect, oneWay);
    this.step(job, Infinity);
    return job.tile;
  }

  /** A tile to build with `step`; draws nothing yet. */
  begin(at: readonly [number, number], flame: number, rect: Rect, oneWay: CapsuleField | null): TileJob {
    const { texel } = this.field;
    const tile = createTarget(rect[2] / texel, rect[3] / texel, 'r8unorm', 'nearest');
    return { at, flame, rect, oneWay, tile, relief: this.relief.job(rect, this.field.texel), raw: null, phase: 'trace', row: 0 };
  }


  /**
   * An area light's tile to build with `step`, around `at` (its middle); draws nothing yet. Its
   * `area.distance` is the field of its outline, which the light map reads too.
   */
  beginArea(at: readonly [number, number], shape: AreaLightShape, rect: Rect, oneWay: CapsuleField | null): TileJob {
    const { texel } = this.field;
    const tile = createTarget(rect[2] / texel, rect[3] / texel, 'r8unorm', 'nearest');
    const distance = createTarget(rect[2] / texel, rect[3] / texel, 'r16float', 'nearest');
    const corners = new Float32Array(AREA_CORNER_VECTORS * 4);
    const count = Math.min(shape.corners.length, AREA_CORNER_VECTORS * 2);
    for (let i = 0; i < count; i++) {
      corners[2 * i] = shape.corners[i]!.x;
      corners[2 * i + 1] = shape.corners[i]!.y;
    }
    const area: AreaJob = { corners, count, bright: shape.bright, dim: shape.dim, reach: shape.reach, blur: shape.blur, distance };
    return { at, flame: 0, rect, oneWay, tile, area, relief: this.relief.job(rect, this.field.texel), raw: null, phase: 'distance', row: 0 };
  }

  /**
   * Draws bands of `job` until `texels` are spent (at least one band, so every step gets on) or
   * the tile is done; returns the texels drawn. Jobs must not be stepped in turn with each other.
   */
  step(job: TileJob, texels: number): number {
    if (job.phase === 'done') return 0;
    // Built here, not in the constructor, which draws nothing (see `LightingWorld`).
    if (!this.noOneWayBuilt) {
      this.noOneWay.build([]);
      this.noOneWayBuilt = true;
    }
    const { texel } = this.field;
    const { pixelWidth: width, pixelHeight: height } = job.tile.source;
    if (!job.raw) {
      this.turn = 1 - this.turn;
      job.raw = this.rawFor(width, height);
      if (job.relief) this.relief.take(job.relief, this.turn);
    }
    const raw = job.raw;
    const u = this.uniforms.uniforms;
    u.uTileRect.set([job.rect[0], job.rect[1], width * texel, height * texel]);
    u.uLight.set(job.at);
    u.uFlame = job.flame;
    u.uTexel = texel;
    u.uHasOneWay = job.oneWay ? 1 : 0;
    u.uTexels.set([width, height]);
    this.bindOneWay(job.oneWay ?? this.noOneWay);
    this.smoothShader.resources.uRaw = raw.source;
    if (job.area) this.setArea(job.area);
    this.relief.bind(job.relief, job.area?.distance ?? null, this.smoothShader);
    let spent = 0;
    while (job.phase !== 'done' && (spent === 0 || spent < texels)) {
      const { target, mesh, next, columns, rows: total } = this.pass(job, raw, width, height);
      const rows = Math.max(1, Math.floor(this.bandTexels / columns));
      const last = Math.min(job.row + rows, total);
      this.setExtent(target, columns, total);
      u.uBand.set([job.row / total, last / total]);
      // The raw bands write every texel the smoothing reads, and the distance bands every texel the trace reads, so neither target needs a clear.
      renderInto(this.renderer, mesh, target, job.phase === 'smooth' && job.row === 0 ? [0, 0, 0, 0] : undefined);
      spent += (last - job.row) * columns;
      job.row = last;
      if (last === total) {
        job.phase = next;
        job.row = 0;
      }
      // Each band goes to the driver on its own, so Windows times each draw on its own.
      if (job.phase !== 'done' && spent < texels) glOf(this.renderer)?.flush();
    }
    u.uBand.set([0, 1]);
    // The raw target is replaced or released and the caller destroys `oneWay`: a destroyed
    // texture must not stay bound.
    this.smoothShader.resources.uRaw = this.placeholder.source;
    this.areaShader.resources.uDistance = this.placeholder.source;
    this.blurShader.resources.uSource = this.placeholder.source;
    this.relief.unbind(this.smoothShader);
    if (job.oneWay) this.bindOneWay(this.noOneWay);
    return spent;
  }

  /**
   * What the job's current phase draws, into which target over how many texels, and the phase
   * after it. An area light's distance field is drawn first and traced through, then blurred for
   * the light map, across into the scratch target and back down into itself. Where the scene has a
   * relief, its shadow is traced after the walls' (while an area's field is still exact) and taken
   * into the smoothing.
   */
  private pass(job: TileJob, raw: RenderTexture, width: number, height: number): { target: RenderTexture; mesh: Mesh<Geometry, Shader>; next: TileJob['phase']; columns: number; rows: number } {
    const { area, relief } = job;
    const tile = { columns: width, rows: height };
    const afterRelief: TileJob['phase'] = area ? 'blurX' : 'smooth';
    switch (job.phase) {
      case 'distance': return { target: area!.distance, mesh: this.distanceMesh, next: 'trace', ...tile };
      case 'trace': return { target: raw, mesh: area ? this.areaMesh : this.mesh, next: relief ? 'relief' : afterRelief, ...tile };
      case 'relief': return { target: relief!.raw!, mesh: this.relief.mesh(!!area), next: afterRelief, columns: relief!.texels[0], rows: relief!.texels[1] };
      case 'blurX': {
        const scratch = this.scratchFor(width, height);
        this.setBlur(area!, area!.distance, [1, 0]);
        return { target: scratch, mesh: this.blurMesh, next: 'blurY', ...tile };
      }
      case 'blurY':
        this.setBlur(area!, this.blurScratch!, [0, 1]);
        return { target: area!.distance, mesh: this.blurMesh, next: 'smooth', ...tile };
      default: return { target: job.tile, mesh: this.smoothMesh, next: 'done', ...tile };
    }
  }

  private setBlur(area: AreaJob, source: RenderTexture, step: [number, number]): void {
    this.blurUniforms.uniforms.uStep.set(step);
    this.blurUniforms.uniforms.uSigma = Math.max(area.blur / this.field.texel, 0.5);
    this.blurShader.resources.uSource = source.source;
  }

  /** The blur's scratch target, at least `width` × `height`. */
  private scratchFor(width: number, height: number): RenderTexture {
    const current = this.blurScratch?.source;
    if (this.blurScratch && current && current.pixelWidth >= width && current.pixelHeight >= height) return this.blurScratch;
    const grown = createTarget(Math.max(width, current?.pixelWidth ?? 0), Math.max(height, current?.pixelHeight ?? 0), 'r16float', 'nearest');
    this.blurScratch?.destroy(true);
    this.blurScratch = grown;
    return grown;
  }

  private setArea(area: AreaJob): void {
    const u = this.areaUniforms.uniforms;
    u.uCorners.set(area.corners);
    u.uCount = area.count;
    u.uAreaBright = area.bright;
    u.uAreaDim = area.dim;
    u.uAreaReach = area.reach;
    this.areaShader.resources.uDistance = area.distance.source;
  }

  destroy(): void {
    this.mesh.destroy();
    this.smoothMesh.destroy();
    this.distanceMesh.destroy();
    this.areaMesh.destroy();
    this.blurMesh.destroy();
    this.geometry.destroy();
    destroyQuad(this.quad);
    this.shader.destroy();
    this.smoothShader.destroy();
    this.distanceShader.destroy();
    this.areaShader.destroy();
    this.blurShader.destroy();
    this.placeholder.destroy(true);
    this.noOneWay.destroy();
    this.release();
    this.relief.destroy();
  }

  /** Frees the raw targets; the next trace allocates them again. Call it only while no job is under way (stepped and not done). */
  release(): void {
    for (let i = 0; i < this.raws.length; i++) {
      this.raws[i]?.destroy(true);
      this.raws[i] = null;
    }
    this.relief.release();
    this.blurScratch?.destroy(true);
    this.blurScratch = null;
  }

  private setExtent(target: RenderTexture, width: number, height: number): void {
    this.uniforms.uniforms.uExtent.set([width / target.source.pixelWidth, height / target.source.pixelHeight]);
  }

  private bindOneWay(field: CapsuleField): void {
    Object.assign(this.shader.resources, field.resources());
    Object.assign(this.smoothShader.resources, field.resources());
    Object.assign(this.areaShader.resources, field.resources());
  }

  /** This turn's raw target, at least `width` × `height`: grown to the largest tile it held. */
  private rawFor(width: number, height: number): RenderTexture {
    const raw = this.raws[this.turn];
    const current = raw?.source;
    if (raw && current && current.pixelWidth >= width && current.pixelHeight >= height) return raw;
    const grown = createTarget(Math.max(width, current?.pixelWidth ?? 0), Math.max(height, current?.pixelHeight ?? 0), 'r8unorm', 'nearest');
    raw?.destroy(true);
    this.raws[this.turn] = grown;
    return grown;
  }
}

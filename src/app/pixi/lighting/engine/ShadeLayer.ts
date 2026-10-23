import { Buffer, BufferUsage, Color, Container, Geometry, Matrix, Mesh, Sprite, Texture, UniformGroup, type Shader } from 'pixi.js';
import { EXPOSURE } from '../../../lighting/lightingConstants';
import { DEFAULT_AMBIENT_COLOR } from '../../../lighting/sceneLightingOptions';
import { srgbToLinear } from '../../../lighting/srgb';
import type { ShadeHatch } from '../../../lighting/shadeHatch';
import { destroyTree } from '../../utils/destroyTree';
import { ENGINE_SHADERS } from './engineShaders';
import { createPlaceholder, createShader } from './gpu';

/** The scene's light as the shade reads it (`ambientShadeFragment`); the lighting's own textures, which it owns. */
export interface AmbientShading {
  lightMap: Texture;
  lightWorld: readonly [number, number];
  /** The zone map, while the scene has ambient zones. */
  zones: Texture | null;
  /** The darkness map, while the scene has magical darkness. */
  darkness: Texture | null;
  ambient: number;
  ambientColor?: string | undefined;
}

/** Whoever draws a level's shade under the scene's light: the lighting hands its light over while it lights the scene, and null before its textures go. */
export interface ShadeSink {
  setLight(light: AmbientShading | null): void;
}

/** A shade image and where it lies: its corners (0..1 across and down) to world pixels, the map's own placement; how an engraving cuts it, where it does. */
export interface PlacedShade {
  texture: Texture;
  uvToWorld: Matrix;
  hatch?: ShadeHatch | null;
}

const CORNERS = [0, 0, 1, 0, 0, 1, 1, 1];

/**
 * A level's shade (`levelShading`), multiplied over its map beneath everything else on it, the
 * tokens too (`MAP_LAYER_Z.shade`). Without lighting it is the shadows the map was drawn without,
 * as they were drawn; while the lighting lights the scene it is the shadow of the ambient light
 * alone (`ambientShadeFragment`). On a renderer without WebGL (PIXI's Canvas renderer) it is a
 * sprite multiplied as it is, which is what an unlit scene shows. The caller owns the texture:
 * set the next one (or none) before destroying it.
 */
export class ShadeLayer implements ShadeSink {
  readonly view = new Container({ label: 'shade' });
  private readonly sprite = new Sprite();
  private readonly mesh: Mesh<Geometry, Shader> | null = null;
  private readonly positions = new Buffer({ data: new Float32Array(8), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
  private readonly placeholder = createPlaceholder();
  private readonly uniforms = new UniformGroup({
    uLightWorld: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uHasZones: { value: 0, type: 'f32' },
    uHasDarkness: { value: 0, type: 'f32' },
    uAmbient: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
    uExposure: { value: EXPOSURE, type: 'f32' },
    uLit: { value: 0, type: 'f32' },
    uHatched: { value: 0, type: 'f32' },
    uHatchInk: { value: new Float32Array(3), type: 'vec3<f32>' },
    uHatch: { value: new Float32Array([1, 0, 1, 0]), type: 'vec4<f32>' },
    uShadeSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uHatchMin: { value: 0, type: 'f32' },
    uShadePerWorld: { value: 1, type: 'f32' },
  });
  private image: PlacedShade | null = null;

  /** `gpu`: the renderer runs WebGL, so the shade can follow the scene's light. */
  constructor(gpu: boolean) {
    this.view.eventMode = 'none';
    this.view.visible = false;
    this.sprite.blendMode = 'multiply';
    if (gpu) {
      const geometry = new Geometry({
        attributes: {
          aPosition: { buffer: this.positions, format: 'float32x2' },
          aUv: { buffer: new Buffer({ data: new Float32Array(CORNERS), usage: BufferUsage.VERTEX }), format: 'float32x2' },
        },
        indexBuffer: new Buffer({ data: new Uint32Array([0, 1, 2, 1, 3, 2]), usage: BufferUsage.INDEX }),
      });
      const resources = { shadeUniforms: this.uniforms, uShade: this.placeholder.source, uLightMap: this.placeholder.source, uZones: this.placeholder.source, uDarkness: this.placeholder.source };
      this.mesh = new Mesh({ geometry, shader: createShader(ENGINE_SHADERS.ambientShade, resources) });
      this.mesh.blendMode = 'multiply';
      this.view.addChild(this.mesh);
    } else {
      this.view.addChild(this.sprite);
    }
  }

  /** The level's shade and where it lies; null, none. */
  setImage(image: PlacedShade | null): void {
    this.image = image;
    this.view.visible = !!image;
    const texture = image?.texture ?? Texture.EMPTY;
    if (this.mesh) {
      this.mesh.shader!.resources.uShade = (image ? texture : this.placeholder).source;
      if (image) this.positions.data = cornersInWorld(image.uvToWorld);
      this.setHatch(image?.hatch ?? null, texture, image?.uvToWorld ?? null);
      return;
    }
    this.sprite.texture = texture;
    if (image) {
      const { a, b, c, d, tx, ty } = image.uvToWorld;
      this.sprite.setFromMatrix(new Matrix(a / texture.width, b / texture.width, c / texture.height, d / texture.height, tx, ty));
    }
  }

  private setHatch(hatch: ShadeHatch | null, texture: Texture, uvToWorld: Matrix | null): void {
    const u = this.uniforms.uniforms;
    u.uHatched = hatch ? 1 : 0;
    if (hatch && uvToWorld) {
      const ink = new Color(hatch.ink);
      u.uHatchInk.set([ink.red, ink.green, ink.blue]);
      // Across the lines: the normal of their direction, as the map's own hatch is cut (`traceHatch`).
      u.uHatch.set([-Math.sin(hatch.angle), Math.cos(hatch.angle), hatch.spacing, hatch.offset]);
      u.uShadeSize.set([texture.width, texture.height]);
      u.uHatchMin = hatch.minWidth;
      u.uShadePerWorld = texture.width / Math.max(Math.hypot(uvToWorld.a, uvToWorld.b), 1e-6);
    }
    this.uniforms.update();
  }

  get shown(): PlacedShade | null {
    return this.image;
  }

  setLight(light: AmbientShading | null): void {
    if (!this.mesh) return;
    const u = this.uniforms.uniforms;
    const resources = this.mesh.shader!.resources;
    u.uLit = light ? 1 : 0;
    resources.uLightMap = (light?.lightMap ?? this.placeholder).source;
    resources.uZones = (light?.zones ?? this.placeholder).source;
    resources.uDarkness = (light?.darkness ?? this.placeholder).source;
    if (light) {
      u.uLightWorld.set(light.lightWorld);
      u.uHasZones = light.zones ? 1 : 0;
      u.uHasDarkness = light.darkness ? 1 : 0;
      const colour = new Color(light.ambientColor ?? DEFAULT_AMBIENT_COLOR);
      u.uAmbient.set([srgbToLinear(colour.red) * light.ambient, srgbToLinear(colour.green) * light.ambient, srgbToLinear(colour.blue) * light.ambient]);
    }
    this.uniforms.update();
  }

  destroy(): void {
    this.setLight(null);
    this.setImage(null);
    this.mesh?.shader?.destroy();
    destroyTree(this.view);
    this.placeholder.destroy(true);
  }
}

/** The quad's corners in world pixels, in the order of `CORNERS`. */
function cornersInWorld(uvToWorld: Matrix): Float32Array {
  const out = new Float32Array(8);
  for (let i = 0; i < 4; i++) {
    const point = uvToWorld.apply({ x: CORNERS[i * 2]!, y: CORNERS[i * 2 + 1]! });
    out[i * 2] = point.x;
    out[i * 2 + 1] = point.y;
  }
  return out;
}

import { Buffer, BufferUsage, Color, Container, Geometry, Matrix, Mesh, Sprite, Texture, UniformGroup, type Shader } from 'pixi.js';
import type { ShadeHatch } from '../../../lighting/shadeHatch';
import { destroyTree } from '../../utils/destroyTree';
import { ENGINE_SHADERS } from './engineShaders';
import { createPlaceholder, createShader } from './gpu';

/**
 * Whoever draws a level's shade: the lighting says while it lights the scene, when the shade is not
 * drawn at all (every shadow is then a light's own, from the relief), and when it stops.
 */
export interface ShadeSink {
  setLit(lit: boolean): void;
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
 * tokens too (`MAP_LAYER_Z.shade`): the shadows the map was drawn without, as they were drawn, so an
 * unlit scene looks as the map always did. While the lighting lights the scene it is not drawn:
 * shadows that all fall one way contradict the lights, which cast their own from the relief
 * (Fabian, 2026-10-23). On a renderer without WebGL (PIXI's Canvas renderer) it is a sprite
 * multiplied as it is. The caller owns the texture: set the next one (or none) before destroying it.
 */
export class ShadeLayer implements ShadeSink {
  readonly view = new Container({ label: 'shade' });
  private readonly sprite = new Sprite();
  private readonly mesh: Mesh<Geometry, Shader> | null = null;
  private readonly positions = new Buffer({ data: new Float32Array(8), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
  private readonly placeholder = createPlaceholder();
  private readonly uniforms = new UniformGroup({
    uHatched: { value: 0, type: 'f32' },
    uHatchInk: { value: new Float32Array(3), type: 'vec3<f32>' },
    uHatch: { value: new Float32Array([1, 0, 1, 0]), type: 'vec4<f32>' },
    uShadeSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uHatchMin: { value: 0, type: 'f32' },
    uShadePerWorld: { value: 1, type: 'f32' },
  });
  private image: PlacedShade | null = null;
  private lit = false;

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
      const resources = { shadeUniforms: this.uniforms, uShade: this.placeholder.source };
      this.mesh = new Mesh({ geometry, shader: createShader(ENGINE_SHADERS.shade, resources) });
      this.mesh.blendMode = 'multiply';
      this.view.addChild(this.mesh);
    } else {
      this.view.addChild(this.sprite);
    }
  }

  /** The level's shade and where it lies; null, none. */
  setImage(image: PlacedShade | null): void {
    this.image = image;
    this.view.visible = !!image && !this.lit;
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

  setLit(lit: boolean): void {
    this.lit = lit;
    this.view.visible = !!this.image && !lit;
  }

  destroy(): void {
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

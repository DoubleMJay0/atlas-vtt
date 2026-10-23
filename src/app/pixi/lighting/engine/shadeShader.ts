import { GLSL_VERSION } from './glsl';

/** The shade's quad in world pixels (`aPosition`), with its image's corners (`aUv`). */
export const shadeVertex = `${GLSL_VERSION}
in vec2 aPosition;
in vec2 aUv;
out vec2 vWorld;
out vec2 vUv;
out float vPixel;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uShadePerWorld;
void main() {
  vWorld = aPosition;
  vUv = aUv;
  // Shade pixels a screen pixel spans: the camera's scale, from world to the target's pixels.
  vPixel = uShadePerWorld / max(length((uWorldTransformMatrix * uTransformMatrix * vec3(1.0, 0.0, 0.0)).xy), 1e-6);
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}`;

/**
 * A level's shade (`uShade`: the shadows its map was drawn without, premultiplied, its alpha where
 * the map has art) multiplied over the map beneath the tokens, as it was drawn; only an unlit scene
 * shows it (`ShadeLayer`). Where the map is an engraving (`uHatched`, `ShadeHatch`) the wash is cut
 * as its hatching: lines of `uHatchInk` across `uHatch.xy`, `uHatch.z` shade pixels apart
 * (`uShadeSize` of them across and down), first through `uHatch.w`, each as wide as the wash is
 * deep, so the line averages to the wash; lines too close on screen to tell apart are drawn as the
 * wash they average to.
 */
export const shadeFragment = `${GLSL_VERSION}
in vec2 vWorld;
in vec2 vUv;
in float vPixel;
uniform sampler2D uShade;
uniform float uHatched;
uniform vec3 uHatchInk;
uniform vec4 uHatch;
uniform float uHatchMin;
uniform vec2 uShadeSize;
out vec4 finalColor;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 hatched(vec3 wash, float across, float pixel) {
  float cover = clamp(dot(vec3(1.0) - wash, LUMA) / max(dot(vec3(1.0) - uHatchInk, LUMA), 1e-3), 0.0, 1.0);
  float spacing = uHatch.z;
  float fromLine = abs(across - spacing * floor(across / spacing + 0.5));
  // The share of the pixel the line covers: its width across the pixel's span, box filtered.
  float halfWidth = 0.5 * cover * spacing;
  // A line narrower than the map would cut is not cut at all.
  float line = 2.0 * halfWidth < uHatchMin ? 0.0 : max(0.0, min(halfWidth, fromLine + 0.5 * pixel) - max(-halfWidth, fromLine - 0.5 * pixel)) / pixel;
  float lines = mix(line, cover, smoothstep(0.25, 0.5, pixel / spacing));
  return mix(vec3(1.0), uHatchInk, lines);
}

void main() {
  vec4 shade = textureLod(uShade, vUv, 0.0);
  float art = shade.a;
  vec3 own = shade.rgb / max(art, 1e-4);
  if (uHatched > 0.5) own = hatched(own, dot(vUv * uShadeSize, uHatch.xy) + uHatch.w, max(vPixel, 1e-4));
  vec3 factor = own;
  // Premultiplied for the multiply blend: where the map holds no art the shade adds nothing.
  finalColor = vec4(factor * art, art);
}`;

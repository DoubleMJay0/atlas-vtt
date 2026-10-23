import { GLSL_VERSION, SRGB_GLSL } from './glsl';

/** The shade's quad in world pixels (`aPosition`), with its image's corners (`aUv`). */
export const ambientShadeVertex = `${GLSL_VERSION}
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
 * the map has art) multiplied over the map beneath the tokens, lit by the scene's light: the shade
 * is the shadow of the ambient light alone, so a point gets of it the share of its light that is
 * ambient, `(A · shade + D) / (A + D)` in linear light, with A the ambient light there (the scene's,
 * a zone's, less what magical darkness swallows) and D the lights' (`uLightMap`, at exposure).
 * In daylight it is the shade itself; under a lamp it fades, and the lamp's own shadows (the
 * relief's, in its tile) take its place. The result is written in sRGB, as the map is: the
 * composite reads the scene beneath it into linear light, where the two multiply alike.
 * Where the map is an engraving (`uHatched`, `ShadeHatch`) the wash is cut as its hatching: lines
 * of `uHatchInk` across `uHatch.xy`, `uHatch.z` shade pixels apart (`uShadeSize` of them across and
 * down), first through `uHatch.w`, each as wide as the wash is deep, so the line averages to the
 * wash; lines too close on screen to tell apart are drawn as the wash they average to.
 */
export const ambientShadeFragment = `${GLSL_VERSION}
in vec2 vWorld;
in vec2 vUv;
in float vPixel;
uniform sampler2D uShade;
uniform sampler2D uLightMap;
uniform vec2 uLightWorld;
uniform sampler2D uZones;
uniform float uHasZones;
uniform sampler2D uDarkness;
uniform float uHasDarkness;
uniform vec3 uAmbient;
uniform float uExposure;
uniform float uLit;
uniform float uHatched;
uniform vec3 uHatchInk;
uniform vec4 uHatch;
uniform float uHatchMin;
uniform vec2 uShadeSize;
out vec4 finalColor;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
${SRGB_GLSL}

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
  if (uLit > 0.5) {
    vec2 at = vWorld / uLightWorld;
    vec3 ambient = uAmbient;
    if (uHasZones > 0.5) {
      vec4 zone = textureLod(uZones, at, 0.0);
      ambient = zone.rgb + uAmbient * (1.0 - zone.a);
    }
    if (uHasDarkness > 0.5) ambient *= 1.0 - textureLod(uDarkness, at, 0.0).r;
    vec3 direct = textureLod(uLightMap, at, 0.0).rgb * uExposure;
    vec3 total = ambient + direct;
    vec3 lit = (ambient * toLinear(own) + direct) / max(total, vec3(1e-6));
    factor = mix(own, toSrgb(lit), step(1e-5, dot(total, vec3(1.0))));
  }
  // Premultiplied for the multiply blend: where the map holds no art the shade adds nothing.
  finalColor = vec4(factor * art, art);
}`;

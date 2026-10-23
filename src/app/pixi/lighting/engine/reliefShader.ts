import { RELIEF } from '../../../lighting/lightingConstants';
import { RELIEF_BLOCK, RELIEF_GROUP } from '../../../lighting/reliefBlocks';
import { MAX_AREA_CORNERS } from '../../../lighting/lightArea';
import { AREA_OUTLINE_GLSL } from './areaTileShader';
import { GLSL_VERSION } from './glsl';

const f = (value: number): string => value.toFixed(4);

/**
 * The relief (`EngineRelief`), read in its own texels: `uRelief` holds the heights in red (0 the
 * floor, 1 a wall's height) on a `uReliefSize` grid, `uReliefBlocks` per block of `RELIEF_BLOCK`
 * texels the highest height of the block and the texels round it (red) and of its group (green),
 * `uWorldToRelief` takes a world point to relief texels. `reliefClear` is whether the straight
 * line from a, standing h0 high, to b, at hb, passes over everything standing higher than both the
 * line and its start (`RELIEF`): the shadow of what stands between them, which never falls on its
 * own top. It skips a group or a block in one step where the line runs above its highest point, and
 * steps half a texel over the rest; a ray out of steps casts no shadow.
 */
export const RELIEF_GLSL = `
uniform sampler2D uRelief;
uniform sampler2D uReliefBlocks;
uniform mat3 uWorldToRelief;
uniform vec2 uReliefSize;

const float RELIEF_BLOCK = ${f(RELIEF_BLOCK)};
const float RELIEF_GROUP_SIDE = ${f(RELIEF_BLOCK * RELIEF_GROUP)};
const float RELIEF_BIAS = ${f(RELIEF.bias)};

vec2 toRelief(vec2 w) { return (uWorldToRelief * vec3(w, 1.0)).xy; }

float reliefAt(vec2 q) { return textureLod(uRelief, q / uReliefSize, 0.0).r; }

// How far along dir from q the box lo..hi ends.
float exitAlong(vec2 q, vec2 dir, vec2 lo, vec2 hi) {
  vec2 t = vec2(1e20);
  if (dir.x > 1e-6) t.x = (hi.x - q.x) / dir.x;
  else if (dir.x < -1e-6) t.x = (lo.x - q.x) / dir.x;
  if (dir.y > 1e-6) t.y = (hi.y - q.y) / dir.y;
  else if (dir.y < -1e-6) t.y = (lo.y - q.y) / dir.y;
  return max(min(t.x, t.y), 0.0);
}

float reliefClear(vec2 a, float h0, vec2 b, float hb) {
  vec2 d = b - a;
  float len = length(d);
  if (len < 0.5) return 1.0;
  vec2 dir = d / len;
  vec2 last = uReliefSize - 0.001;
  // Nothing not higher than the start shades it.
  float own = h0 + RELIEF_BIAS;
  float s = 0.5;
  for (int i = 0; i < ${RELIEF.steps}; i++) {
    if (s >= len) return 1.0;
    vec2 q = clamp(a + dir * s, vec2(0.0), last);
    float line = mix(h0, hb, s / len);
    vec2 cell = floor(q / RELIEF_BLOCK);
    vec2 tops = texelFetch(uReliefBlocks, ivec2(cell), 0).rg;
    vec2 group = floor(q / RELIEF_GROUP_SIDE) * RELIEF_GROUP_SIDE;
    float leave = exitAlong(q, dir, group, group + RELIEF_GROUP_SIDE);
    if (tops.g <= max(own, min(line, mix(h0, hb, min(s + leave, len) / len)) + RELIEF_BIAS)) {
      s += leave + 0.01;
      continue;
    }
    vec2 block = cell * RELIEF_BLOCK;
    leave = exitAlong(q, dir, block, block + RELIEF_BLOCK);
    if (tops.r <= max(own, min(line, mix(h0, hb, min(s + leave, len) / len)) + RELIEF_BIAS)) {
      s += leave + 0.01;
      continue;
    }
    if (reliefAt(q) > max(own, line + RELIEF_BIAS)) return 0.0;
    s += 0.5;
  }
  return 1.0;
}`;

/**
 * A relief shadow tile: `uReliefRect` is its world rect (origin, size), one texel of it no finer
 * than a texel of the relief or of the light map; `uReliefTexels` its texels (xy) and its target's
 * (zw). Its pass covers its target's corner the way every tile pass does (`tileVertex`).
 */
const RELIEF_TILE_GLSL = `
in vec2 vUv;
uniform vec4 uReliefRect;
uniform vec4 uReliefTexels;
out vec4 finalColor;
float jitterHere() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }`;

/**
 * Share of a point light's flame a texel sees past what stands (`reliefClear`): rays across the
 * flame (`RELIEF.flame` of its radius, `uReliefOffsets` across it, jittered within their strips)
 * to the light, which stands `RELIEF.lightHeight` above the relief where it is. Walls are the
 * tile's (`tileFragment`): this only darkens it, in the smoothing (`tileSmoothFragment`).
 */
export const reliefPointFragment = `${GLSL_VERSION}
${RELIEF_TILE_GLSL}
uniform vec2 uLight;
uniform float uFlame;
uniform float uReliefOffsets[${RELIEF.rays}];
${RELIEF_GLSL}
void main() {
  vec2 p = uReliefRect.xy + vUv * uReliefRect.zw;
  vec2 a = toRelief(p);
  float h0 = reliefAt(a);
  float hl = reliefAt(toRelief(uLight)) + ${f(RELIEF.lightHeight)};
  vec2 dir = normalize(uLight - p + vec2(1e-6));
  vec2 across = vec2(-dir.y, dir.x) * uFlame * ${f(RELIEF.flame)};
  float jitter = jitterHere() - 0.5;
  float seen = 0.0;
  for (int k = 0; k < ${RELIEF.rays}; k++) {
    float lo = k > 0 ? uReliefOffsets[k - 1] : -1.0;
    float hi = k < ${RELIEF.rays - 1} ? uReliefOffsets[k + 1] : 1.0;
    float x = uReliefOffsets[k] + jitter * (jitter < 0.0 ? uReliefOffsets[k] - lo : hi - uReliefOffsets[k]);
    seen += reliefClear(a, h0, toRelief(uLight + across * x), hl);
  }
  finalColor = vec4(seen / ${f(RELIEF.rays)}, 0.0, 0.0, 1.0);
}`;

/**
 * What the relief pass reads of an area light's tile: the distance to its outline the tile holds
 * (`uDistance`, never more than it is, as `areaTileFragment` reads it), and the angle the area
 * fills as seen from a point. A ray is weighed by how bright the light is where it meets the area
 * (the knee between its two levels, without the tail, which only the light map shapes): near shore
 * counts more than far shore, as in its tile.
 */
const RELIEF_AREA_READS_GLSL = `
uniform float uAreaBright;
uniform float uBrightLevel;
uniform float uDimLevel;
uniform float uAreaReach;
uniform sampler2D uDistance;

float areaDistance(vec2 w) {
  vec2 lo = uTileRect.xy;
  vec2 hi = lo + uTileRect.zw;
  if (any(lessThan(w, lo)) || any(greaterThan(w, hi))) return 1e20;
  return textureLod(uDistance, (w - lo) / uTileRect.zw, 0.0).r - 0.75 * uTexel;
}

float rayWeight(float d) {
  float t = d / max(uAreaBright, 1.0);
  float t2 = t * t;
  return mix(uDimLevel, uBrightLevel, 1.0 / (1.0 + t2 * t2));
}

// The angle the area fills from p (lo..hi), measured from ref, the direction to its nearest point.
void areaSpan(vec2 p, vec2 nearest, out vec2 ref, out vec2 side, out float lo, out float hi) {
  ref = normalize(nearest - p + vec2(1e-6, 0.0));
  side = vec2(-ref.y, ref.x);
  lo = 0.0;
  hi = 0.0;
  vec2 v = corner(uCount - 1) - p;
  float previous = atan(dot(v, side), dot(v, ref));
  for (int i = 0; i < ${MAX_AREA_CORNERS}; i++) {
    if (i >= uCount) break;
    v = corner(i) - p;
    float angle = atan(dot(v, side), dot(v, ref));
    if (abs(angle - previous) > 3.14159265) {
      lo = -3.14159265;
      hi = 3.14159265;
    }
    lo = min(lo, angle);
    hi = max(hi, angle);
    previous = angle;
  }
}`;

/**
 * Share of an area light a texel sees past what stands: rays spread over the angle the area fills
 * from it (`areaSpan`), each marching towards the area (`areaDistance`) while it looks for what
 * stands higher than the texel and the area's glow (`RELIEF.areaHeight` above its surface), weighed
 * by how bright the light is where it meets the area (`rayWeight`).
 * Inside the area the share is 1. Needs the area's tile uniforms (`uTileRect`, `uTexel`, `uCorners`).
 */
export const reliefAreaFragment = `${GLSL_VERSION}
${RELIEF_TILE_GLSL}
uniform vec4 uTileRect;
uniform float uTexel;
${AREA_OUTLINE_GLSL}
${RELIEF_AREA_READS_GLSL}
${RELIEF_GLSL}

// Whether the way from p (relief point a, height h0) along dir meets the area within its reach, past what stands; the distance it met it at in weight.
float rayToArea(vec2 p, vec2 a, float h0, vec2 dir, out float met) {
  vec2 toward = mat2(uWorldToRelief) * dir;
  float scale = max(length(toward), 1e-6);
  vec2 dirR = toward / scale;
  // A ray rises from the texel to the glow; it is shaded by what stands above both.
  float line = max(h0, ${f(RELIEF.areaHeight)}) + RELIEF_BIAS;
  vec2 last = uReliefSize - 0.001;
  float s = 0.5;
  met = -1.0;
  bool shaded = false;
  for (int i = 0; i < ${RELIEF.steps}; i++) {
    float world = s / scale;
    vec2 w = p + dir * world;
    float toArea = areaDistance(w);
    if (toArea <= 0.5 * uTexel) {
      met = world;
      break;
    }
    if (world > uAreaReach) break;
    float step = toArea * scale;
    if (!shaded) {
      vec2 q = clamp(a + dirR * s, vec2(0.0), last);
      vec2 cell = floor(q / RELIEF_BLOCK);
      vec2 tops = texelFetch(uReliefBlocks, ivec2(cell), 0).rg;
      vec2 group = floor(q / RELIEF_GROUP_SIDE) * RELIEF_GROUP_SIDE;
      vec2 block = cell * RELIEF_BLOCK;
      if (tops.g <= line) step = min(step, exitAlong(q, dirR, group, group + RELIEF_GROUP_SIDE) + 0.01);
      else if (tops.r <= line) step = min(step, exitAlong(q, dirR, block, block + RELIEF_BLOCK) + 0.01);
      else {
        if (reliefAt(q) > line) shaded = true;
        step = 0.5;
      }
    }
    s += max(step, 0.5);
  }
  return shaded ? 0.0 : 1.0;
}

void main() {
  vec2 p = uReliefRect.xy + vUv * uReliefRect.zw;
  vec2 nearest;
  float here = outlineDistance(p, nearest);
  float vis = 1.0;
  if (here > 0.0 && here < uAreaReach) {
    vec2 a = toRelief(p);
    float h0 = reliefAt(a);
    vec2 ref;
    vec2 side;
    float lo;
    float hi;
    areaSpan(p, nearest, ref, side, lo, hi);
    float jitter = jitterHere();
    float total = 0.0;
    float seen = 0.0;
    for (int k = 0; k < ${RELIEF.rays}; k++) {
      float angle = mix(lo, hi, (float(k) + jitter) / ${f(RELIEF.rays)});
      vec2 dir = ref * cos(angle) + side * sin(angle);
      float met;
      float clear = rayToArea(p, a, h0, dir, met);
      if (met < 0.0) continue;
      float weight = rayWeight(met);
      total += weight;
      seen += weight * clear;
    }
    vis = total > 0.0 ? seen / total : 1.0;
  }
  finalColor = vec4(vis, 0.0, 0.0, 1.0);
}`;

/**
 * A light's relief shadow (`uReliefShadow`, the tile of `reliefPointFragment` or `reliefAreaFragment`)
 * at world point w, a texel's tent around it, so the steps between its rays melt into a ramp. 1
 * without a relief (`uHasRelief` 0): the smoothing then writes exactly what it did before reliefs.
 */
export const RELIEF_SHADOW_GLSL = `
uniform float uHasRelief;
uniform vec4 uReliefRect;
uniform vec4 uReliefTexels;
uniform sampler2D uReliefShadow;
float reliefShadow(vec2 w) {
  if (uHasRelief < 0.5) return 1.0;
  vec2 t = (w - uReliefRect.xy) / uReliefRect.zw * uReliefTexels.xy;
  vec2 lo = vec2(0.5);
  vec2 hi = uReliefTexels.xy - 0.5;
  float sum = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      float weight = float((2 - abs(i)) * (2 - abs(j)));
      sum += weight * textureLod(uReliefShadow, clamp(t + vec2(i, j), lo, hi) / uReliefTexels.zw, 0.0).r;
    }
  }
  return sum / 16.0;
}`;

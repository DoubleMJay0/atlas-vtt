/**
 * Acid: a faint shimmer over the painted pool, darker towards \`uDeep\` away from the shore, and
 * bubbles: some cells of a fine lattice hold one, which swells as a small dome with a glint on
 * it, pops into a fading ring and comes back, each at a pace of its own (whole cycles per loop).
 */
export const ACID_GLSL = `
vec4 acid(vec2 q, float d, float px, float near) {
  float depth = smoothstep(0.05, 1.5, d);
  float shimmer = fbm((q - uDriftA.xy) * 1.5, vec2(TILE * 1.5), 3, px * 1.5) + fbm((q - uDriftA.zw) * 2.5, vec2(TILE * 2.5), 2, px * 2.5) * 0.6;

  vec2 b = (q - uDriftB.xy) * 3.0;
  vec2 cell = floor(b);
  vec4 h = hash42(mod(cell, vec2(TILE * 3.0)) + uSeed + 17.0);
  float pace = floor(mix(420.0, 900.0, h.z));
  float life = fract(uTime * (pace / LOOP) + h.w);
  float has = step(h.y, 0.6) * smoothstep(0.08, 0.45, d);
  float size = mix(0.12, 0.26, h.x);
  vec2 centre = 0.27 + 0.46 * h.xy;
  vec2 at = b - cell - centre;
  float dist = length(at);
  float edgeWidth = 0.02 + px * 2.5;

  // Swelling: a dome lighter than the acid, a dark rim, a glint towards the light.
  float swell = smoothstep(0.0, 0.85, life) * step(life, 0.88);
  float radius = size * swell;
  float dome = (1.0 - smoothstep(radius - edgeWidth, radius, dist)) * swell;
  float rimLine = (1.0 - smoothstep(0.0, edgeWidth, abs(dist - radius))) * swell;
  float glint = (1.0 - smoothstep(0.0, radius * 0.4 + edgeWidth, length(at + radius * vec2(0.35, 0.4)))) * swell;
  // Popping: a thin ring running out and fading.
  float burst = smoothstep(0.88, 1.0, life);
  float ring = (1.0 - smoothstep(0.0, edgeWidth, abs(dist - size * (1.0 + burst * 1.6)))) * step(0.88, life) * (1.0 - burst);
  float shownHere = has * shown(0.12, px * 3.0);

  float alpha = clamp(0.06 + depth * 0.22 - shimmer * 0.1 + rimLine * 0.3 * shownHere, 0.0, 0.5);
  vec3 colour = uDeep * alpha;
  colour += mix(uSurface, uGlint, 0.5) * smoothstep(0.05, 0.4, shimmer) * 0.07;
  colour += mix(uSurface, uGlint, 0.6) * dome * (0.12 + 0.18 * smoothstep(0.0, radius, dist)) * shownHere;
  colour += uGlint * glint * 0.4 * shownHere;
  colour += uGlint * ring * 0.25 * shownHere;
  return vec4(colour, alpha);
}
`;

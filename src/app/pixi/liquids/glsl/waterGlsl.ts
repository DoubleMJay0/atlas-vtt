/**
 * Water: the painted water darkens towards \`uDeep\` away from the shore, soft ripples drift across
 * it (along the flow on a channel, stretched into streaks; in place on a pool), the light they
 * gather on the bottom draws a slowly moving net of caustics in \`uGlint\`, brightest where its
 * lines cross, and a channel carries thin lines of foam downstream. Everything fine fades as the map is zoomed out.
 * \`near\` is 0 far out (about 45 screen pixels a cell) and 1 close in (120 and more).
 */
export const WATER_GLSL = `
vec4 water(vec2 q, float d, float px, float near) {
  bool flowing = uFlowing > 0.5;
  float depth = smoothstep(0.05, 1.8, d);
  float shallow = 1.0 - smoothstep(0.0, 1.2, d);
  vec2 stretch = flowing ? vec2(1.5, 0.5) : vec2(1.0);
  float pxS = px * max(stretch.x, stretch.y);

  vec2 w0 = (q - uDriftA.xy) * 0.5;
  vec2 warp = vec2(fbm(w0, vec2(TILE * 0.5), 3, px * 0.5), fbm(w0 + vec2(5.0, 9.0), vec2(TILE * 0.5), 3, px * 0.5));
  vec2 p = q + warp * 0.8;

  float r1 = fbm((p - uDriftA.zw) * stretch * 1.5, TILE * stretch * 1.5, 4, pxS * 1.5);
  float r2 = fbm((p - uDriftB.xy) * stretch * 3.0, TILE * stretch * 3.0, 3, pxS * 3.0);
  float ripple = r1 * 0.65 + r2 * 0.35;

  // Caustics: the edges of slowly turning cells, bent by the ripples, two scales drifting apart.
  // On a channel the cells are drawn out along the flow.
  vec2 drawnOut = flowing ? vec2(1.0, 0.5) : vec2(1.0);
  vec2 c = p + vec2(r1, r2) * (flowing ? 0.45 : 0.7) - uDriftB.zw;
  float e1 = voronoi(c * drawnOut * 1.5, TILE * drawnOut * 1.5, 0.18).y;
  float e2 = voronoi(c * drawnOut * 2.5 + vec2(r2, r1) * 0.6 + 11.0, TILE * drawnOut * 2.5, 0.22).y;
  float line1 = 1.0 - smoothstep(0.0, 0.09 + px * 3.0, e1);
  float line2 = 1.0 - smoothstep(0.0, 0.07 + px * 5.0, e2);
  float caustic = line1 * line1 * 0.5 + line2 * line2 * 0.3 + line1 * line2 * 0.7;
  caustic *= shown(0.6, px * 1.5) * mix(0.35, 1.0, near);

  // Foam lines carried downstream on a channel.
  float foam = 0.0;
  if (flowing) {
    float streak = 1.0 - abs(gnoise((p - uDriftA.zw) * vec2(5.0, 0.75), vec2(TILE * 5.0, TILE * 0.75)) * 2.4);
    foam = pow(clamp(streak, 0.0, 1.0), 6.0) * smoothstep(-0.1, 0.25, r1) * shown(0.2, px * 5.0) * (0.5 + 0.5 * shallow);
  }

  // A soft band breathing in from the shore.
  float lap = (1.0 - smoothstep(0.0, 0.35, d)) * (0.5 + 0.5 * sin(TAU * (cycles(368.0) - d * 1.5) + r1 * 4.0));

  float alpha = clamp(0.05 + depth * 0.3 - ripple * 0.14, 0.0, 0.55);
  vec3 colour = uDeep * alpha;
  colour += mix(uSurface, uGlint, 0.4) * smoothstep(0.0, 0.3, ripple) * 0.06;
  colour += uGlint * caustic * mix(0.2, 0.09, depth);
  colour += uGlint * foam * 0.22;
  colour += uGlint * lap * 0.05;
  return vec4(colour, alpha);
}
`;

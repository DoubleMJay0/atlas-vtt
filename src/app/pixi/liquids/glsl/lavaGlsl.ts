/**
 * Lava: plates of cooled crust in \`uDeep\` drift and turn slowly over the molten \`uSurface\` the map
 * paints. Between them the melt shows, wider where it runs hot; their edges glow from below, fine
 * cracks in them glimmer, and the seams breathe in \`uGlint\` as the heat beneath them rises and
 * falls. The crust thickens towards the shore, where lava cools first.
 */
export const LAVA_GLSL = `
vec4 lava(vec2 q, float d, float px, float near) {
  float depth = smoothstep(0.0, 1.6, d);
  vec2 w0 = (q - uDriftA.xy) * 0.375;
  vec2 warp = vec2(fbm(w0, vec2(TILE * 0.375), 3, px * 0.375), fbm(w0 + vec2(7.0, 3.0), vec2(TILE * 0.375), 3, px * 0.375));
  vec2 p = q + warp * 1.2;

  // Heat: where the melt wells up, slowly; the crust there thins and its seams widen.
  float heat = clamp(fbm((p - uDriftB.xy) * 0.75, vec2(TILE * 0.75), 3, px * 0.75) * 1.4 + 0.5, 0.0, 1.0);
  float breathe = 0.72 + 0.28 * sin(TAU * (cycles(480.0) + heat * 0.8 + d * 0.15));

  // Plates: cells whose edges a finer warp roughens, the roughness travelling with them.
  vec2 drifted = p - uDriftA.zw;
  vec2 rough = vec2(gnoise(drifted * 3.0, vec2(TILE * 3.0)), gnoise(drifted * 3.0 + 5.0, vec2(TILE * 3.0))) * 0.12 * shown(0.33, px);
  vec2 onPlates = drifted + rough;
  float plateScale = 0.875;
  vec3 plate = voronoi(onPlates * plateScale, vec2(TILE * plateScale), 0.1);
  float edge = plate.y / plateScale;
  float seamWidth = max(mix(0.025, 0.11, smoothstep(0.35, 0.9, heat)), px * 1.2);
  float coolness = mix(0.85, 0.5, depth) - heat * 0.55 + (plate.z - 0.5) * 0.35;
  float crust = smoothstep(0.08, 0.2, coolness);

  float body = smoothstep(seamWidth * 0.5, seamWidth * 1.4, edge) * crust;
  float rim = exp(-max(edge - seamWidth, 0.0) * 9.0);

  // The crust itself: dark, grained rock, its wrinkles catching the glow from below near its edges.
  float grain = fbm(drifted * 5.0, vec2(TILE * 5.0), 3, px * 5.0);
  float wrinkle = 1.0 - abs(gnoise(onPlates * 7.0, vec2(TILE * 7.0)) * 2.0);
  wrinkle = pow(clamp(wrinkle, 0.0, 1.0), 5.0) * shown(0.14, px);
  vec3 rock = uDeep * (0.75 + grain * 0.9) + uDeep * wrinkle * 0.5;
  vec3 crustColour = mix(rock, mix(uDeep, uSurface, 0.55), rim * 0.75);
  float alpha = body * mix(0.8, 0.9, depth);
  vec3 colour = crustColour * alpha;

  // Fine cracks across a plate, glowing faintly where the plate is thin.
  float crack = 0.0;
  if (near * body > 0.0) {
    float fine = voronoiFast(onPlates * 3.25 + 17.0, vec2(TILE * 3.25), 0.05).y / 3.25;
    crack = (1.0 - smoothstep(0.0, 0.02 + px * 2.0, fine)) * body * near * smoothstep(0.25, 0.9, heat * 0.6 + rim);
  }

  float seam = (1.0 - smoothstep(seamWidth * 0.3, seamWidth * 1.2, edge)) * crust;
  float hot = smoothstep(0.4, 0.95, heat);
  vec3 molten = mix(uSurface, uGlint, 0.2 + 0.65 * hot);
  colour += mix(uSurface, uGlint, 0.55 + 0.35 * hot) * seam * breathe * 0.9;
  colour += uSurface * rim * crust * 0.18 * breathe;
  colour += mix(uSurface, uGlint, 0.35) * crack * breathe * 0.35;
  colour += molten * (1.0 - crust) * (0.12 + 0.4 * hot) * breathe;
  // The open melt's own slow currents.
  float current = fbm((p - uDriftB.zw) * 2.0 + warp, vec2(TILE * 2.0), 3, px * 2.0);
  colour += uGlint * (1.0 - crust) * smoothstep(0.05, 0.3, current) * 0.25 * breathe;
  return vec4(colour, alpha);
}
`;

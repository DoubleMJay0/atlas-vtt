/**
 * The map's own illustration in motion. Painted water carries broad, matte reflections;
 * engraved water carries only tapered ink strokes and small openings in the hatch. All
 * blending stays between the map's pigments (no additive white caustics). The existing
 * signed shore distance protects banks and islands; the static drawing supplies fine grain.
 * High/balanced/saver use 3/2/1 noise octaves and omit finer marks. No extra texture samples.
 */
export const WATER_GLSL = `
// An antialiased ribbon, its width in cells. Never sharpen a subpixel line into shimmer.
float waterRibbon(float distance, float width, float px) {
  return (1.0 - smoothstep(max(0.0, width - px), width + px, abs(distance)))
    * min(1.0, width / max(px, 0.0001));
}

vec4 water(vec2 q, float d, float px, float near) {
  int octaves = uDetail > 1.5 ? 3 : uDetail > 0.5 ? 2 : 1;
  vec2 stretch = uFlowing > 0.5 ? vec2(0.75, 0.375) : vec2(0.5, 0.5);
  vec2 p = (q - uDriftA.xy) * stretch;
  float body = fbm(p, TILE * stretch, octaves, px * 0.75);
  float bend = gnoise((q - uDriftA.zw) * vec2(0.5, 1.0), TILE * vec2(0.5, 1.0));
  float depth = smoothstep(0.08, 1.6, d);
  float bank = 1.0 - smoothstep(0.08, 0.45, d);
  float lap = 0.5 + 0.5 * sin(TAU * cycles(192.0) + body * 5.0);

  if (uEngraved > 0.5) {
    // Level burin marks, like the static water hatch. Flow advects their envelopes, not
    // their orientation: a vertical channel must not turn an engraving's lines vertical.
    vec2 mapCell = vWorld / uCell;
    float phase = mapCell.y * 4.0 + bend * 0.18 - cycles(96.0);
    float lineDistance = (fract(phase + 0.5) - 0.5) / 4.0;
    float envelope = smoothstep(-0.05, 0.24, body + bend * 0.4);
    float width = (0.004 + 0.008 * depth) * envelope;
    float stroke = waterRibbon(lineDistance, width, px) * envelope;
    // The sounding's contour moves by only a fraction of its width, broken in places.
    float shore = waterRibbon(d - (0.12 + lap * 0.018), 0.008, px)
      * smoothstep(-0.15, 0.18, bend);
    float open = 0.0;
    if (uDetail > 0.5) {
      open = waterRibbon(lineDistance + 0.025, 0.013, px)
        * smoothstep(0.06, 0.22, -body) * 0.12;
    }
    float ink = (stroke * (0.19 + depth * 0.13) + shore * 0.13) * shown(0.12, px);
    return vec4(uDeep * ink + uGlint * open * (1.0 - ink), ink + open * (1.0 - ink));
  }

  // Wide, softly bent reflections; no network or regular wave train over the painted floor.
  float sheen = smoothstep(-0.02, 0.23, body + bend * 0.12);
  float glint = 0.0;
  if (uDetail > 0.5) {
    float fine = gnoise((q - uDriftB.xy) * vec2(1.0, 2.0), TILE * vec2(1.0, 2.0));
    float reflection = abs(bend + body * 0.65 + fine * 0.08);
    glint = (1.0 - smoothstep(0.015, 0.065 + px, reflection))
      * smoothstep(0.0, 0.2, body) * mix(0.35, 1.0, near);
  }
  float shade = 0.025 + depth * 0.065 + smoothstep(-0.03, 0.24, -body) * 0.035;
  float light = sheen * 0.20 + glint * 0.22 + bank * lap * 0.018;
  // Ordinary source-over pigment: colour never exceeds alpha, including monochrome.
  return vec4(uDeep * shade * (1.0 - light) + uGlint * light, shade * (1.0 - light) + light);
}
`;

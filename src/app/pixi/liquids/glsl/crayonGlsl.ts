/**
 * Liquids in Crayon's hand, as an animator draws them: short bowed crayon strokes that the hand draws
 * anew a few times a second ("boil"), planted on the paper at the map's own hatch angle, and which of
 * them show is decided by the same moving fields the painted liquids use, so the water still flows and
 * the crust still drifts. The paper's grain stays where it lies and breaks every stroke, as it breaks
 * the static crayon. Water: pale strokes where light lies on the drifting body, deeper blue in its
 * troughs, graphite ripple dashes, laps at the shore and drip rings. Lava: flame strokes along the hot
 * seams, breathing with its light, ember between, dark crust strokes on the rafts and pencilled cracks.
 * Acid: green strokes heavier at the bank and pencilled bubbles. Premultiplied pigment, never above
 * alpha, over the map. Must follow the water, lava and acid code, whose fields it reads.
 */
export const CRAYON_GLSL = `
// Drawings a second: the hand redraws its strokes this often, which is what a hand-drawn liquid moves by.
const float BOIL = 6.0;
// The static crayon's hatch angle, radians, and its second pass a little turned.
const float CRAYON_ANGLE = -0.66;

/** Which drawing of the boil is shown now. */
float crayonFrame() { return floor(uTime * BOIL); }

/** How much colour the paper's grain keeps at this pixel: still, a map pixel a grain. */
float crayonTooth() {
  return 0.62 + 0.38 * hash22(floor(vWorld) + 0.5).x;
}

/**
 * One pass of crayon strokes over the map (cells): lines \`gap\` apart at \`angle\`, each broken into
 * strokes about \`len\` long that start, stop and bow where the hand put them in this drawing.
 */
float crayonStrokes(vec2 p, float angle, float gap, float len, float width, float frame, float px) {
  vec2 dir = vec2(cos(angle), sin(angle));
  float along = dot(p, dir);
  float across = dot(p, vec2(-dir.y, dir.x));
  float line = floor(across / gap);
  vec4 l = hash42(vec2(line, frame) + uSeed);
  float s = along / len + l.x * 17.0;
  vec4 g = hash42(vec2(floor(s), line * 1.37 + frame * 7.0) + uSeed + 5.0);
  float t = fract(s);
  float a = 0.04 + g.x * 0.18;
  float b = 0.78 + g.y * 0.2;
  float inStroke = smoothstep(a, a + 0.06, t) * (1.0 - smoothstep(b - 0.06, b, t));
  float bow = (g.z - 0.5) * gap * 0.45 * sin(3.14159265 * clamp((t - a) / (b - a), 0.0, 1.0));
  float centre = (line + 0.5 + (l.y - 0.5) * 0.3) * gap + bow;
  float w = width * (0.75 + 0.25 * g.w);
  return waterRibbon(across - centre, w * 0.5, px) * inStroke * step(0.15, l.z * 0.7 + g.w * 0.3);
}

/** Lays \`colour\` at coverage \`a\` over premultiplied \`under\`. */
vec4 crayonOver(vec4 under, vec3 colour, float a) {
  return under * (1.0 - a) + vec4(colour * a, a);
}

vec4 crayonWater(vec2 q, float d, float px) {
  int octaves = uDetail > 1.5 ? 3 : uDetail > 0.5 ? 2 : 1;
  vec2 field = waterField(q, d, px, octaves);
  float body = field.x;
  float wave = field.y;
  float depth = smoothstep(0.08, 1.6, d);
  vec2 cells = vWorld / uCell;
  float frame = crayonFrame();
  float tooth = crayonTooth();
  float light = smoothstep(0.0, 0.14, body + wave * 0.05);
  float trough = smoothstep(0.0, 0.14, -body) * (0.45 + 0.55 * depth);
  float pale = crayonStrokes(cells, CRAYON_ANGLE, 0.05, 0.42, 0.034, frame, px) * light;
  float blue = crayonStrokes(cells, CRAYON_ANGLE + 0.1, 0.06, 0.36, 0.032, frame + 101.0, px) * trough;
  // Graphite: the ripple lines, drawn a little elsewhere in every drawing, the laps and the rings.
  // The ripples lie where the field crosses zero; its value over its slope is the distance in cells.
  float wobble = (hash22(vec2(frame, 3.0) + uSeed).x - 0.5) * 0.04;
  float broken = smoothstep(-0.1, 0.6, sin(TAU * body * 3.2 + 1.0));
  float cellsAway = (wave + wobble) / max(fwidth(wave), 1e-4) * px;
  float ripple = waterRibbon(cellsAway, 0.007, px) * broken * shown(0.3, px);
  float lap = waterLap(d, body, wave, 0.016, px) * shown(0.08, px);
  float rings = uDetail > 0.5 && uFlowing < 0.5 ? waterRings(cells, d, wave, 0.014, px) * shown(0.1, px) : 0.0;
  float ink = max(max(ripple * 0.75, lap * 0.85), rings * 0.8);
  vec4 colour = crayonOver(vec4(0.0), uSurface, blue * 0.6 * tooth);
  colour = crayonOver(colour, uGlint, pale * 0.78 * tooth);
  return crayonOver(colour, uDeep, ink * tooth);
}

vec4 crayonLava(vec2 q, float d, float px) {
  float depth = smoothstep(0.03, 1.1, d);
  int octaves = uDetail > 1.5 ? 2 : 1;
  vec2 w = (q - uDriftA.xy) * 0.5;
  float bend = fbm(w, vec2(TILE * 0.5), octaves, px * 0.5);
  // The crust drifts as rafts; the strokes stay on the paper and show where the rafts are now.
  vec2 p = q - uDriftA.zw + vec2(bend, bend * 0.6) * 0.5;
  float heat = 0.5 + fbm((q - uDriftB.xy) * 0.75, vec2(TILE * 0.75), octaves, px * 0.75);
  vec3 plate = voronoiFast(p * 2.5, vec2(TILE * 2.5), 0.0);
  float edge = plate.y / 2.5;
  float hot = (1.0 - smoothstep(0.03, 0.1, edge)) * smoothstep(0.35, 0.7, heat + plate.z * 0.2);
  float crusted = smoothstep(0.06, 0.13, edge) * (1.0 - smoothstep(0.55, 0.8, heat) * depth * 0.6);
  vec2 cells = vWorld / uCell;
  float frame = crayonFrame();
  float tooth = crayonTooth();
  float ember = crayonStrokes(cells, CRAYON_ANGLE + 0.1, 0.055, 0.34, 0.034, frame + 57.0, px) * (1.0 - crusted * 0.7);
  float crust = crayonStrokes(cells, CRAYON_ANGLE + 1.5, 0.065, 0.28, 0.03, frame + 211.0, px) * crusted;
  float flame = crayonStrokes(cells, CRAYON_ANGLE, 0.045, 0.3, 0.036, frame, px) * hot * uLavaGlow;
  float wobble = (hash22(vec2(frame, 9.0) + uSeed).x - 0.5) * 0.006;
  float crack = waterRibbon(edge + wobble, 0.009, px) * crusted * (1.0 - hot) * shown(0.1, px);
  vec4 colour = crayonOver(vec4(0.0), uSurface, ember * 0.62 * tooth);
  colour = crayonOver(colour, uDeep, crust * 0.5 * tooth);
  colour = crayonOver(colour, uGlint, flame * 0.88 * tooth);
  return crayonOver(colour, uDeep, crack * 0.7 * tooth);
}

vec4 crayonAcid(vec2 q, float d, float px) {
  float current = fbm((q - uDriftA.xy) * 0.75, vec2(TILE * 0.75), int(uDetail) + 1, px * 0.75);
  float bank = 1.0 - smoothstep(0.08, 0.5, d + current * 0.1);
  vec3 bubble = acidBubble(q, d, px);
  vec2 cells = vWorld / uCell;
  float frame = crayonFrame();
  float tooth = crayonTooth();
  float stain = crayonStrokes(cells, CRAYON_ANGLE, 0.055, 0.36, 0.034, frame, px) * (0.35 + 0.65 * max(bank, smoothstep(0.0, 0.3, current)));
  float swell = crayonStrokes(cells, CRAYON_ANGLE + 1.4, 0.05, 0.2, 0.03, frame + 31.0, px) * bubble.y;
  vec4 colour = crayonOver(vec4(0.0), uSurface, stain * 0.6 * tooth);
  colour = crayonOver(colour, uGlint, swell * 0.7 * tooth);
  return crayonOver(colour, uDeep, bubble.x * 0.8 * tooth);
}
`;

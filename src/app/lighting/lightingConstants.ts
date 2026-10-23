import type { MapBounds } from '../vision/visibility';

/** Distances in the wall field are clamped here; sphere tracing never needs a longer step. */
export const FIELD_MAX = 128;
/** World pixels per texel of the world-space lighting textures on ordinary maps. */
export const BASE_TEXEL = 2;
/** Longest side of a world-space texture; larger maps get coarser texels. */
export const MAX_TEXELS = 4096;
/**
 * Farthest a light may reach, in world pixels: the side of the largest map lit at full
 * resolution. A light's tile is cut to the map, so the engine never traces more than this.
 */
export const MAX_LIGHT_REACH = MAX_TEXELS * BASE_TEXEL;
/**
 * Rays traced across a light's flame per tile texel in its penumbra, at most: the lower lighting
 * qualities trace fewer (`LightingQuality.tileRays`).
 */
export const TILE_RAYS = 32;
/**
 * Most tile texels one draw traces. A light's tile is traced in bands of rows within this, each
 * handed to the driver on its own: Windows resets a graphics device whose draw runs for about two
 * seconds, and a torch's whole tile in one draw came close to that on integrated graphics, losing
 * every WebGL context of the window.
 */
export const TILE_BAND_TEXELS = 1 << 17;
/**
 * Largest radius, in texels, over which a traced tile is smoothed: it melts the steps between
 * ray counts into a ramp. Each texel smooths only within its wall clearance, so less near walls.
 */
export const TILE_SMOOTH = 4;
/**
 * The picture's tail: past its dim radius, where the rules stop counting it, a light eases out
 * over this share of the dim radius, as real light spills into the dark (a fade of 8 % looked
 * like light that stops; Fabian, 2026-10-23). What lies in the tail looks faintly lit and is not
 * counted: a token standing there is unseen. Walls stop the tail like any light.
 */
export const LIGHT_TAIL = 0.5;
/** Where a light ends in the picture, as a multiple of its dim radius: its tiles reach this far. */
export const LIGHT_REACH = 1 + LIGHT_TAIL;
/**
 * The tail is shaped in what the eye sees, not in light (`TAIL_GLSL`): the light itself falls as
 * that curve to this power, about the display's (sRGB is near a 2.4 power), so its brightness
 * on screen eases out without a ring at the dim radius and without a visible end.
 */
export const TAIL_POWER = 2.4;
/** Rays a light's tile traces across its flame in its tail, at most: the tail is faint, and far texels cost the most. */
export const TAIL_RAYS = 8;
/**
 * How much light a light gives in its two ranges (HDR, before exposure): `bright` up to the
 * bright radius, `dim` from there to the dim radius, with a soft knee between them. The
 * composite tonemaps a light at its bright level and scales the result back, so every floor
 * shows the dim range at the same share of the bright range, about a third; it must not fall
 * under a quarter (`lightFalloff.gpu.test.ts`).
 */
export const LIGHT_LEVELS = { bright: 1.25, dim: 0.4 } as const;
export const EXPOSURE = 0.9;
/** Light colours are mixed this far towards white, so tinted light keeps the map readable. */
export const TINT_TO_WHITE = 0.5;
/** Smallest flame, as a share of the dim radius, so shadow edges never look cut out. */
export const MIN_SOFTNESS = 0.12;
/** Strength of the cool grey shift where the light is low and none of it a light's own (ambient, bounce). */
export const PURKINJE = 0.55;

/**
 * How wide, in world pixels, a beam's sides are soft at most: as long as the tail past its dim
 * radius. What lies there looks lit and is not counted, like the tail.
 */
export function softEdge(dim: number): number {
  return LIGHT_TAIL * dim;
}
/**
 * A light that shines one way gives its full light inside its cone, where the rules count it,
 * and eases out past the cone's sides as past its dim radius (`TAIL_GLSL`), over its soft edge
 * (`softEdge`, a width, not an angle: an angle grows with the distance). That width is also held
 * to a share (`BEAM_EDGE`) of the beam's half-width at that distance (`beamEdge`), so a beam
 * keeps its shape: a narrow beam has narrow soft sides, which widen with the distance as a real
 * beam's penumbra does. A beam wider than a half turn leaves a dark wedge behind the light, and
 * the edge is held to that wedge's half-width instead, so it never fills the wedge. The beam's
 * far end has the tail every light has, and its own space (the cone's apex), which is lit all
 * around, eases out over the edge it has at that radius.
 */
export const BEAM_EDGE = 0.4;
/** A beam's edge is never narrower than this many texels of the light map, where it is drawn: a narrower one shows the texels as steps. */
export const BEAM_EDGE_TEXELS = 1;

/**
 * The width of a beam's soft edge at `distance` from its light: `edge` (`softEdge`), and no more
 * than `BEAM_EDGE` of the half-width there of the beam of `angle` (radians), or of the dark wedge
 * behind it, but for the `BEAM_EDGE_TEXELS` it takes to draw it smoothly.
 */
export function beamEdge(edge: number, distance: number, angle: number, texel: number): number {
  return Math.min(edge, Math.max(BEAM_EDGE_TEXELS * texel, BEAM_EDGE * distance * Math.sin(Math.min(angle / 2, Math.PI - angle / 2))));
}


/**
 * A source of magical darkness swallows all light up to its radius; over the last `rim` world
 * pixels inside it (and no more than the fade past a light's dim radius) the light comes back,
 * so its edge is soft and nothing beyond the radius is darkened. The rule counts the rim as dark:
 * it is kept narrow, since a wide one shows daylight where a token is hidden. `veil` is the faint cool tint (linear light) the players see in place of the map
 * there, to tell magical darkness from the unlit dark; `gmVeil` the stronger one the GM sees
 * over the dim map.
 */
export const DARKNESS = {
  rim: 6,
  veil: [0.003, 0.0026, 0.011],
  gmVeil: [0.03, 0.022, 0.085],
} as const;

/**
 * Reflected light: what a light's lit floor gives back into the shadows next to it, one bounce,
 * so a room round a corner from a torch is dimly lit and a token standing there is seen.
 * *Rule*: the floor along the edges of the light's shadows reflects; a point with a clear line to
 * such a point of the floor is in dim light while the whole way, light to floor to point, is no
 * longer than the light's dim range, and the second part no longer than `share` of it (where
 * the floor is brightly lit, less where it is less lit) or `cells` grid cells. So a light never
 * reaches past its own range, and the next room gets what of it is left. *Picture*: in the
 * light's colour at `level` (HDR) next to brightly lit floor it comes from (less next to less lit
 * floor), down to `edge` of `level` where the rule stops counting it, then easing out as a light's tail does
 * (`TAIL_GLSL`) by `fade` times its reach, blurred within the free floor over `blur` of its
 * longest reach, so the points it is traced from show as one soft spill.
 */
export const REFLECTION = {
  share: 0.4,
  cells: 3,
  level: 0.32,
  edge: 0.45,
  fade: LIGHT_REACH,
  blur: 0.1,
} as const;

/**
 * Shadows from heights (a level's relief, `EngineRelief`): heights are shares of a wall's (the
 * relief's 1). A placed or carried light stands `lightHeight` above what it stands on (a torch
 * held, a lamp on a post); an area light glows `areaHeight` above its surface (lava), so whatever
 * stands near it throws a long low shadow. A point of the floor is in an object's shadow where the
 * straight line from its own height to the light passes under something standing higher than both
 * that line and the point itself: what stands never shades its own top, which stays lit, and only
 * what is taller shades a top. Each shadow is soft by `flame` of the light's flame, from `rays`
 * rays across it. `bias` is the height a point must stand above the line to count, against the
 * relief's steps; a ray takes at most `steps` steps (beyond, nothing shades it).
 */
export const RELIEF = {
  lightHeight: 0.5,
  areaHeight: 0.04,
  flame: 0.55,
  rays: 8,
  bias: 0.02,
  steps: 384,
} as const;

export const BOUNCE = {
  probe: 16,
  interval: 16,
  cascades: 4,
  emitTexel: 4,
  spread: 250,
  floorGain: 0.001,
  wallGain: 0.6,
  gain: 1,
  /** While lights move, bounce is rebuilt at most this often. */
  throttleMs: 100,
} as const;

/**
 * Animated lights are redrawn at most this often, about 30 times a second: flicker walks step
 * every 45–120 ms and are interpolated in between. A little under two 60 Hz frames, so a frame
 * that comes early never waits for the next one.
 */
export const FLICKER_INTERVAL_MS = 30;

/**
 * A soft glow around each flame, drawn with the light so it stays inside its walls; an
 * image-space bloom would blur light across walls. `gain` is its peak on top of the falloff
 * (HDR), `size` its Gaussian sigma as a share of the bright radius.
 */
export const HALO = { gain: 0.8, size: 0.25 } as const;

/**
 * World pixels per texel for a map: 2 px, coarser on maps longer than 8,192 px, or than twice
 * `maxTexels` where the lighting quality holds its textures smaller (`LightingQuality`). The
 * rules always read the map at the default: what is sealed must not depend on the device.
 */
export function worldTexel(bounds: MapBounds, maxTexels = MAX_TEXELS): number {
  return Math.max(BASE_TEXEL, Math.max(bounds.width, bounds.height) / maxTexels);
}

/**
 * Walls are capsules this wide around their centre line: at least a texel's diagonal, so a
 * bilinear sample of a world texture never carries light past the centre line.
 */
export function wallRadius(texel: number): number {
  return Math.max(3, texel * Math.SQRT2 + 0.01);
}

/** Bilinear interpolation of a 1-Lipschitz field overestimates it by less than this. */
export function fieldMargin(texel: number): number {
  return texel * 0.75;
}

/**
 * Within this distance of a wall's centre line a pixel keeps its own light: closer in, the wall
 * field's gradient may point across the line.
 */
export function wallCore(texel: number): number {
  return 1.5 * texel;
}

/**
 * How far before a limited wall that stops it a light ends in the light map: as far as a solid
 * wall's capsule reaches for a trace, so the two look alike and no bilinear read of the light
 * map carries light across the wall's centre line.
 */
export function limitedMargin(texel: number): number {
  return wallRadius(texel) + fieldMargin(texel);
}

/**
 * Distance from a wall's centre line at which the light map is fully lit again: past the capsule
 * (tiles are lit wherever the trace clears it) and the light map's bilinear texel.
 */
export function wallBand(texel: number): number {
  return wallRadius(texel) + fieldMargin(texel) + texel;
}

/**
 * How far from its centre line a wall still changes a tile: smoothing reads a texel's clearance
 * up to `TILE_SMOOTH` texels, plus a texel for the bilinear field.
 */
export function tileWallReach(texel: number): number {
  return wallRadius(texel) + fieldMargin(texel) + (TILE_SMOOTH + 1) * texel;
}

/**
 * Wall ends closer than this to another wall are joined by a bridge, for light and sight
 * alike: wider than any gap the field closes by itself (two capsules with their bilinear
 * margin, plus the tile's contact fade), so light and sight always agree on what is closed.
 */
export function sealTolerance(texel: number): number {
  return 2 * (wallRadius(texel) + fieldMargin(texel)) + 2 * texel;
}

/**
 * Limited walls that run within this distance of each other without crossing are one hedge to
 * a ray that meets both there: the seal tolerance of a map at the base texel, so hedge ends
 * the sealing joins, drawn short of each other or past each other, count once.
 */
export const LIMITED_JOIN = sealTolerance(BASE_TEXEL);

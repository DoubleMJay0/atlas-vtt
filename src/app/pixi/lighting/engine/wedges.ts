import { BufferImageSource } from 'pixi.js';
import type { Point } from '../../../types/visionTypes';
import type { SightWedge } from '../../../vision/sightWedges';
import { DISC_SHARE_GLSL } from './glsl';

/** Wedges a fragment tests at most; more corners than this per polygon stay hard. */
export const MAX_WEDGES = 256;

/** Sectors of the full turn around a polygon's origin that wedges are sorted into. */
const SECTORS = 64;
const SECTOR = (2 * Math.PI) / SECTORS;
/** A wedge is listed in the sectors a little beyond its own, so a bearing the shader rounds otherwise still finds it. */
const SECTOR_SLACK = 0.01;

/**
 * A polygon's soft shadow edges (`sightWedges`, `wedgeTexture`): `wedgeShare` multiplies `share`
 * by what each wedge leaves at world point `w`, rising to 1 at its inner side as a round source
 * comes into view: from 0 on the shadow edge with `edge` 0 (sight fades out there); with `edge`
 * above 0 (light) the lit half of a flame's penumbra, half the flame in view on the shadow's edge,
 * which a light map's texels would draw as steps, so it rises from 0 to that half over the first
 * `edge` world pixels. Only ever lowers, and only inside the polygon. A wedge
 * lies beyond its corner and opens by its angle, so seen from the polygon's `origin` it spans no
 * more than that angle from its corner's bearing: only the wedges listed in the sector of `w`'s
 * bearing are tested, which leaves out none that could lower it.
 */
export const WEDGE_GLSL = `
uniform sampler2D uWedges;
${DISC_SHARE_GLSL}
float wedgeShare(vec2 w, vec2 origin, float share, float edge) {
  vec2 o = w - origin;
  float bearing = atan(o.y, o.x);
  int sector = clamp(int(floor((bearing + 3.14159265) / ${SECTOR.toFixed(8)})), 0, ${SECTORS - 1});
  vec2 listed = texelFetch(uWedges, ivec2(sector, 2), 0).xy;
  int first = int(listed.x + 0.5);
  int count = int(listed.y + 0.5);
  for (int k = 0; k < ${MAX_WEDGES}; k++) {
    if (k >= count) break;
    int i = int(texelFetch(uWedges, ivec2(first + k, 3), 0).x + 0.5);
    vec4 ae = texelFetch(uWedges, ivec2(i, 0), 0);
    vec2 sp = texelFetch(uWedges, ivec2(i, 1), 0).xy;
    vec2 v = w - ae.xy;
    float theta = atan(sp.x * (ae.z * v.y - ae.w * v.x), dot(ae.zw, v));
    if (theta < 0.0 || theta >= sp.y) continue;
    if (edge <= 0.0) {
      share *= discShare(2.0 * theta / sp.y - 1.0);
    } else {
      // How far from the shadow's edge, across it, and the penumbra's lit half.
      float across = length(v) * sin(min(theta, 1.5707963));
      share *= discShare(theta / sp.y) * clamp(across / edge, 0.0, 1.0);
    }
  }
  return share;
}`;

/**
 * The wedges of a polygon around `origin` as `WEDGE_GLSL` reads them, four rows of `rgba32float`
 * texels: corner and edge, then side and angle, one column per wedge; then per sector of the turn
 * around the origin where its list starts and how long it is, and the lists of wedge indices.
 * Each list keeps its wedges in their own order, so the share is the same product as over all of them.
 */
export function wedgeTexture(wedges: readonly SightWedge[], origin: Point): BufferImageSource {
  const lists: number[][] = Array.from({ length: SECTORS }, () => []);
  wedges.forEach((wedge, i) => {
    const corner = Math.atan2(wedge.a.y - origin.y, wedge.a.x - origin.x);
    const lo = wedge.side > 0 ? corner : corner - wedge.phi;
    const from = Math.floor((lo - SECTOR_SLACK + Math.PI) / SECTOR);
    const to = Math.floor((lo + wedge.phi + SECTOR_SLACK + Math.PI) / SECTOR);
    for (let s = from; s <= to; s++) lists[((s % SECTORS) + SECTORS) % SECTORS]!.push(i);
  });
  const indices = lists.flat();
  const width = Math.max(1, wedges.length, SECTORS, indices.length);
  const data = new Float32Array(width * 4 * 4);
  wedges.forEach((w, i) => {
    data.set([w.a.x, w.a.y, w.e.x, w.e.y], i * 4);
    data.set([w.side, w.phi, 0, 0], (width + i) * 4);
  });
  let first = 0;
  lists.forEach((list, s) => {
    data.set([first, list.length], (2 * width + s) * 4);
    first += list.length;
  });
  indices.forEach((index, k) => { data[(3 * width + k) * 4] = index; });
  // Premultiplying on upload is invalid for float data and leaves the texture empty.
  return new BufferImageSource({
    resource: data,
    width,
    height: 4,
    format: 'rgba32float',
    scaleMode: 'nearest',
    alphaMode: 'no-premultiply-alpha',
  });
}

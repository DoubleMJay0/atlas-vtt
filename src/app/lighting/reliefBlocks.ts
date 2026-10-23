/**
 * A relief's heights summed up in blocks, so a ray over it skips what cannot cast a shadow: a
 * ray whose line runs above a block's highest point passes the whole block in one step, and one
 * above its group's in one step more. Read bilinearly, a texel's height reaches into its
 * neighbours, so each block's highest takes in the texels round it.
 */

/** Relief texels along a block's side. */
export const RELIEF_BLOCK = 4;
/** Blocks along a group's side. */
export const RELIEF_GROUP = 8;

export interface ReliefBlocks {
  /** RGBA bytes per block: red the highest height of the block and the texels round it, green that of its group. */
  data: Uint8Array;
  columns: number;
  rows: number;
}

/** The blocks of a relief of `width` × `height` texels, one height byte each (0 the floor, 255 a wall). */
export function reliefBlocks(heights: Uint8Array, width: number, height: number): ReliefBlocks {
  const columns = Math.max(1, Math.ceil(width / RELIEF_BLOCK));
  const rows = Math.max(1, Math.ceil(height / RELIEF_BLOCK));
  const block = new Uint8Array(columns * rows);
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < columns; bx++) {
      let top = 0;
      const y0 = Math.max(0, by * RELIEF_BLOCK - 1), y1 = Math.min(height - 1, (by + 1) * RELIEF_BLOCK);
      const x0 = Math.max(0, bx * RELIEF_BLOCK - 1), x1 = Math.min(width - 1, (bx + 1) * RELIEF_BLOCK);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) top = Math.max(top, heights[y * width + x]!);
      block[by * columns + bx] = top;
    }
  }
  const data = new Uint8Array(columns * rows * 4);
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < columns; bx++) {
      const gx = Math.floor(bx / RELIEF_GROUP) * RELIEF_GROUP, gy = Math.floor(by / RELIEF_GROUP) * RELIEF_GROUP;
      let group = 0;
      for (let y = gy; y < Math.min(rows, gy + RELIEF_GROUP); y++) for (let x = gx; x < Math.min(columns, gx + RELIEF_GROUP); x++) group = Math.max(group, block[y * columns + x]!);
      const k = (by * columns + bx) * 4;
      data[k] = block[by * columns + bx]!;
      data[k + 1] = group;
      data[k + 3] = 255;
    }
  }
  return { data, columns, rows };
}

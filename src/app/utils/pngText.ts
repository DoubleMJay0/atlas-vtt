/**
 * A PNG's text chunks (`tEXt`: a Latin-1 keyword, a zero byte, Latin-1 text), the place a picture
 * keeps what it says about itself. Atlas writes one into an image it makes and reads it back from
 * the same bytes; a viewer that does not know the keyword shows the picture as it is.
 */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const TEXT = 'tEXt';

let table: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const byte of bytes) c = table[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const latin1 = (text: string): number[] => Array.from(text, (ch) => ch.charCodeAt(0) & 0xff);

function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 33 && SIGNATURE.every((value, i) => bytes[i] === value);
}

/** `png` with a text chunk `keyword` holding `text` (ASCII) right after its header; the same bytes when they are no PNG. */
export function withPngText(png: Uint8Array, keyword: string, text: string): Uint8Array {
  if (!isPng(png)) return png;
  const body = new Uint8Array([...latin1(TEXT), ...latin1(keyword), 0, ...latin1(text)]);
  const chunk = new Uint8Array(body.length + 8);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, body.length - 4);
  chunk.set(body, 4);
  view.setUint32(4 + body.length, crc32(body));
  // The header chunk is the first, 13 bytes long: the text goes after it, before the image data.
  const at = 8 + 12 + 13;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, at));
  out.set(chunk, at);
  out.set(png.subarray(at), at + chunk.length);
  return out;
}

/** The text of `png`'s text chunk `keyword`, before its image data; null where it has none, or is no PNG. */
export function readPngText(png: Uint8Array, keyword: string): string | null {
  if (!isPng(png)) return null;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = 8;
  while (at + 12 <= png.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (type === 'IDAT' || type === 'IEND' || at + 12 + length > png.length) return null;
    if (type === TEXT) {
      const body = png.subarray(at + 8, at + 8 + length);
      const zero = body.indexOf(0);
      if (zero >= 0 && String.fromCharCode(...body.subarray(0, zero)) === keyword) return String.fromCharCode(...body.subarray(zero + 1));
    }
    at += 12 + length;
  }
  return null;
}

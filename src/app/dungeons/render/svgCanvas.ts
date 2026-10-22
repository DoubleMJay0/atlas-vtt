/**
 * A drawing context that writes SVG: the part of Canvas 2D the dungeon renderer uses (paths,
 * arcs, fills and strokes, clipping, text, the inner shadow's blurred and multiplied fill),
 * recorded in device pixels and written out as SVG elements, so the page saved as SVG is the
 * page drawn on a canvas, line for line. Text is measured on a real canvas of the same fonts.
 */

import { escapeXml, IDENTITY, multiply, num, SvgPathBuilder, type Matrix } from './svgPath';

interface State {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  lineCap: CanvasLineCap;
  lineDash: number[];
  lineDashOffset: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  globalCompositeOperation: GlobalCompositeOperation;
  matrix: Matrix;
  /** The id of the clip path in force, which holds every clip before it. */
  clip: string | null;
}

export class SvgCanvas extends SvgPathBuilder {
  private state: State = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    lineDash: [],
    lineDashOffset: 0,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalCompositeOperation: 'source-over',
    matrix: IDENTITY,
    clip: null,
  };
  private readonly stack: State[] = [];
  private readonly defs: string[] = [];
  private readonly body: string[] = [];
  private ids = 0;

  /** `measure` sets the font of a real 2D context, which measures every text drawn. */
  constructor(readonly width: number, readonly height: number, private readonly measure: CanvasText & CanvasTextDrawingStyles) {
    super();
  }

  protected get matrix(): Matrix {
    return this.state.matrix;
  }

  // Styles ---------------------------------------------------------------------------------------

  get fillStyle(): string { return this.state.fillStyle; }
  set fillStyle(value: string | CanvasGradient | CanvasPattern) { if (typeof value === 'string') this.state.fillStyle = value; }
  get strokeStyle(): string { return this.state.strokeStyle; }
  set strokeStyle(value: string | CanvasGradient | CanvasPattern) { if (typeof value === 'string') this.state.strokeStyle = value; }
  get lineWidth(): number { return this.state.lineWidth; }
  set lineWidth(value: number) { if (value > 0 && Number.isFinite(value)) this.state.lineWidth = value; }
  get lineJoin(): CanvasLineJoin { return this.state.lineJoin; }
  set lineJoin(value: CanvasLineJoin) { this.state.lineJoin = value; }
  get lineCap(): CanvasLineCap { return this.state.lineCap; }
  set lineCap(value: CanvasLineCap) { this.state.lineCap = value; }
  get lineDashOffset(): number { return this.state.lineDashOffset; }
  set lineDashOffset(value: number) { this.state.lineDashOffset = value; }
  get font(): string { return this.state.font; }
  set font(value: string) { this.state.font = value; }
  get textAlign(): CanvasTextAlign { return this.state.textAlign; }
  set textAlign(value: CanvasTextAlign) { this.state.textAlign = value; }
  get textBaseline(): CanvasTextBaseline { return this.state.textBaseline; }
  set textBaseline(value: CanvasTextBaseline) { this.state.textBaseline = value; }
  get shadowColor(): string { return this.state.shadowColor; }
  set shadowColor(value: string) { this.state.shadowColor = value; }
  get shadowBlur(): number { return this.state.shadowBlur; }
  set shadowBlur(value: number) { this.state.shadowBlur = value; }
  get shadowOffsetX(): number { return this.state.shadowOffsetX; }
  set shadowOffsetX(value: number) { this.state.shadowOffsetX = value; }
  get shadowOffsetY(): number { return this.state.shadowOffsetY; }
  set shadowOffsetY(value: number) { this.state.shadowOffsetY = value; }
  get globalCompositeOperation(): GlobalCompositeOperation { return this.state.globalCompositeOperation; }
  set globalCompositeOperation(value: GlobalCompositeOperation) { this.state.globalCompositeOperation = value; }

  setLineDash(segments: number[]): void {
    this.state.lineDash = segments.length % 2 === 0 ? [...segments] : [...segments, ...segments];
  }

  getLineDash(): number[] {
    return [...this.state.lineDash];
  }

  save(): void {
    this.stack.push({ ...this.state, lineDash: [...this.state.lineDash] });
  }

  restore(): void {
    const state = this.stack.pop();
    if (state) this.state = state;
  }

  // Transform ------------------------------------------------------------------------------------

  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.state.matrix = multiply(this.state.matrix, [a, b, c, d, e, f]);
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.state.matrix = [a, b, c, d, e, f];
  }

  translate(x: number, y: number): void { this.transform(1, 0, 0, 1, x, y); }
  scale(x: number, y: number): void { this.transform(x, 0, 0, y, 0, 0); }
  rotate(angle: number): void { this.transform(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0); }

  getTransform(): DOMMatrix {
    const [a, b, c, d, e, f] = this.state.matrix;
    return new DOMMatrix([a, b, c, d, e, f]);
  }

  // Drawing --------------------------------------------------------------------------------------

  fill(rule: CanvasFillRule = 'nonzero'): void {
    if (this.path.length === 0) return;
    this.emit(`d="${this.path.join('')}" fill="${escapeXml(this.state.fillStyle)}"${rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}`);
  }

  stroke(): void {
    if (this.path.length === 0) return;
    this.emit(`d="${this.path.join('')}" fill="none"${this.strokeAttributes()}`);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const saved = { path: this.path, last: this.last, start: this.start };
    this.beginPath();
    this.rect(x, y, w, h);
    this.fill();
    ({ path: this.path, last: this.last, start: this.start } = saved);
  }

  clip(rule: CanvasFillRule = 'nonzero'): void {
    const id = `c${++this.ids}`;
    const parent = this.state.clip ? ` clip-path="url(#${this.state.clip})"` : '';
    this.defs.push(`<clipPath id="${id}"${parent}><path d="${this.path.join('') || 'M0 0'}"${rule === 'evenodd' ? ' clip-rule="evenodd"' : ''}/></clipPath>`);
    this.state.clip = id;
  }

  measureText(text: string): TextMetrics {
    this.measure.font = this.state.font;
    this.measure.textAlign = this.state.textAlign;
    this.measure.textBaseline = this.state.textBaseline;
    return this.measure.measureText(text);
  }

  fillText(text: string, x: number, y: number): void {
    this.text(text, x, y, `fill="${escapeXml(this.state.fillStyle)}"`);
  }

  strokeText(text: string, x: number, y: number): void {
    this.text(text, x, y, `fill="none"${this.strokeAttributes()}`);
  }

  // Output ---------------------------------------------------------------------------------------

  /** The drawing as an SVG document; `styles` goes into its stylesheet (the fonts' faces). */
  toSvg(styles = ''): string {
    const defs = [styles ? `<style>${styles}</style>` : '', ...this.defs].join('');
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">`,
      defs ? `<defs>${defs}</defs>` : '',
      ...this.body,
      '</svg>\n',
    ].join('');
  }

  // Inside ---------------------------------------------------------------------------------------

  private strokeAttributes(): string {
    const { strokeStyle, lineWidth, lineJoin, lineCap, lineDash, lineDashOffset } = this.state;
    const unit = this.unit;
    let out = ` stroke="${escapeXml(strokeStyle)}" stroke-width="${num(lineWidth * unit)}"`;
    if (lineJoin !== 'miter') out += ` stroke-linejoin="${lineJoin}"`;
    if (lineCap !== 'butt') out += ` stroke-linecap="${lineCap}"`;
    if (lineDash.length > 0) {
      out += ` stroke-dasharray="${lineDash.map(n => num(n * unit)).join(' ')}"`;
      if (lineDashOffset) out += ` stroke-dashoffset="${num(lineDashOffset * unit)}"`;
    }
    return out;
  }

  /** Text at its alphabetic baseline and left edge, as the canvas would have placed it. */
  private text(text: string, x: number, y: number, paint: string): void {
    const metrics = this.measureText(text);
    // How far below the asked baseline the alphabetic one lies, as the canvas measures it.
    this.measure.textBaseline = 'alphabetic';
    const baseline = this.measure.measureText(text).actualBoundingBoxAscent - metrics.actualBoundingBoxAscent;
    const align = this.state.textAlign;
    const shift = align === 'center' ? -metrics.width / 2 : align === 'right' || align === 'end' ? -metrics.width : 0;
    const [a, b, c, d, e, f] = this.state.matrix;
    const transform = `matrix(${[a, b, c, d, e, f].map(num).join(' ')})`;
    const element = `<text transform="${transform}" x="${num(x + shift)}" y="${num(y + baseline)}" style="font: ${escapeXml(this.state.font)}; white-space: pre" ${paint}>${escapeXml(text)}</text>`;
    // Clip and shadow are in page pixels: they go on a group around the turned text.
    const extra = this.effects();
    this.body.push(extra ? `<g${extra}>${element}</g>` : element);
  }

  /** One path in page pixels, with the clip, shadow and blending in force. */
  private emit(attributes: string): void {
    this.body.push(`<path ${attributes}${this.effects()}/>`);
  }

  private effects(): string {
    const { clip, globalCompositeOperation } = this.state;
    let extra = '';
    if (clip) extra += ` clip-path="url(#${clip})"`;
    const filter = this.shadowFilter();
    if (filter) extra += ` filter="url(#${filter})"`;
    if (globalCompositeOperation === 'multiply') extra += ' style="mix-blend-mode: multiply"';
    return extra;
  }

  /** The canvas shadow as a filter, in page pixels as the canvas takes them; null when there is none. */
  private shadowFilter(): string | null {
    const { shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY } = this.state;
    if (!shadowBlur && !shadowOffsetX && !shadowOffsetY) return null;
    if (/^rgba\(.*,\s*0\s*\)$/.test(shadowColor.replace(/\s+/g, ' ')) || shadowColor === 'transparent') return null;
    const id = `s${++this.ids}`;
    this.defs.push(
      `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${this.width}" height="${this.height}" color-interpolation-filters="sRGB">`
      + `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(shadowBlur / 2)}"/>`
      + `<feOffset dx="${num(shadowOffsetX)}" dy="${num(shadowOffsetY)}" result="blur"/>`
      + `<feFlood flood-color="${escapeXml(shadowColor)}"/>`
      + '<feComposite in2="blur" operator="in" result="shadow"/>'
      + '<feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
    );
    return id;
  }
}

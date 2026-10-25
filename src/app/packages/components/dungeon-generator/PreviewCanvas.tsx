import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Skeleton, SkeletonGroup } from '../primitives/Skeleton';
import { observeResize } from '../../../utils/observeResize';
import { MOTION_EASE_OUT } from '../../../utils/motion';
import { cn } from '../../../../utils/cn';
import { t } from '../../../i18n';
import type { DungeonView } from '../../../dungeons/style';
import { revealPlan } from './reveal/revealPlan';
import { playReveal } from './reveal/revealPlayer';
import type { MapPicture } from './useMapPreview';

/** The longest side a preview is drawn at, in device pixels. */
const MAX_PREVIEW_SIDE = 2400;
/** How long a new picture takes to fade in over the last. */
const CROSSFADE_MS = 280;

export interface PreviewSize {
  width: number;
  height: number;
}

/** The device pixels a frame of this many CSS pixels holds, within `MAX_PREVIEW_SIDE`. */
function previewSizeOf(cssWidth: number, cssHeight: number, ratio: number): PreviewSize | null {
  if (cssWidth < 1 || cssHeight < 1) return null;
  const scale = Math.min(ratio, MAX_PREVIEW_SIDE / Math.max(cssWidth, cssHeight));
  return { width: Math.round(cssWidth * scale), height: Math.round(cssHeight * scale) };
}

/** Measures the frame the map is fitted into; null until it has a size. */
export function usePreviewSize(frame: HTMLElement | null): PreviewSize | null {
  const [size, setSize] = useState<PreviewSize | null>(null);
  useLayoutEffect(() => {
    if (!frame) return undefined;
    const measure = (): void => {
      const rect = frame.getBoundingClientRect();
      const next = previewSizeOf(rect.width, rect.height, frame.ownerDocument.defaultView?.devicePixelRatio || 1);
      setSize((old) => (old && next && old.width === next.width && old.height === next.height ? old : next));
    };
    measure();
    return observeResize([frame], measure);
  }, [frame]);
  return size;
}

interface PreviewCanvasProps {
  picture: MapPicture | null;
  drawing: boolean;
  failed: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  className?: string;
  /** Laid over the map, inside its edges (its tools, the floor switcher). */
  children?: React.ReactNode;
  /** Which rooms the map shows, for the order a new dungeon grows in. */
  view: Pick<DungeonView, 'secrets'>;
}

/** The CSS size of an element, kept up to date; null until it has one. */
function useCssSize(element: HTMLElement | null): PreviewSize | null {
  const [size, setSize] = useState<PreviewSize | null>(null);
  useLayoutEffect(() => {
    if (!element) return undefined;
    const measure = (): void => {
      const { width, height } = element.getBoundingClientRect();
      if (width < 1 || height < 1) {
        setSize(null);
        return;
      }
      setSize((old) => (old && old.width === width && old.height === height ? old : { width, height }));
    };
    measure();
    return observeResize([element], measure);
  }, [element]);
  return size;
}

/** The largest box of `aspect` (width over height) within `room`. */
export function containedIn(room: PreviewSize, aspect: number): PreviewSize {
  const width = Math.min(room.width, room.height * aspect);
  return { width: Math.round(width), height: Math.round(width / aspect) };
}

/** How long the last dungeon takes to dissolve while a new one grows in its place. */
const DISSOLVE_MS = 700;

/** Lays the picture shown on `ghost` and fades it out, so the picture drawn next melts in under it. */
function fadeOut(canvas: HTMLCanvasElement, ghost: HTMLCanvasElement | null, durationMs = CROSSFADE_MS): void {
  if (!ghost || canvas.width === 0 || typeof ghost.animate !== 'function') return;
  ghost.width = canvas.width;
  ghost.height = canvas.height;
  ghost.getContext('2d')?.drawImage(canvas, 0, 0);
  const reduced = ghost.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 0 : durationMs, easing: MOTION_EASE_OUT, fill: 'forwards' });
}

/**
 * The drawn map, or its skeleton until the first picture arrived, as one surface exactly the
 * map's shape and as large as the room allows (its edges glide when the shape changes), so the
 * map never reaches past it. A picture is held while the next is drawn, so changing a setting
 * never empties the pane, and each new one fades in over the last; while one takes a moment, the
 * picture shown dims a little. A new dungeon grows into being instead (`playReveal`), out of the
 * last one as it dissolves.
 */
export function PreviewCanvas({ picture, drawing, failed, canvasRef, className, children, view }: PreviewCanvasProps): React.JSX.Element {
  const reduced = useReducedMotion() ?? false;
  // Whether a new dungeon is growing, and whether it grows out of nothing rather than out of the last one.
  const [revealing, setRevealing] = useState<'first' | 'next' | null>(null);
  const stopReveal = useRef<(() => void) | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [waiting, setWaiting] = useState(false);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const room = useCssSize(stage);
  const box = room && picture ? containedIn(room, picture.bitmap.width / picture.bitmap.height) : room;
  const shown = useRef<ImageBitmap | null>(null);
  const ghost = useRef<HTMLCanvasElement>(null);
  const labelId = useId();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !picture || shown.current === picture.bitmap) return;
    // A reveal under way ends where it is going, so the picture taken over is whole
    stopReveal.current?.();
    stopReveal.current = null;
    const first = shown.current === null;
    shown.current = picture.bitmap;
    if (picture.fresh && !reduced) {
      if (!first) fadeOut(canvas, ghost.current, DISSOLVE_MS);
      setRevealing(first ? 'first' : 'next');
      const plan = revealPlan(picture.model, viewRef.current, picture.map, picture.floor, picture.bitmap);
      stopReveal.current = playReveal(canvas, picture.bitmap, plan, () => setRevealing(null));
      return;
    }
    setRevealing(null);
    fadeOut(canvas, ghost.current);
    canvas.width = picture.bitmap.width;
    canvas.height = picture.bitmap.height;
    canvas.getContext('2d')?.drawImage(picture.bitmap, 0, 0);
  }, [picture, canvasRef, reduced]);

  useEffect(() => () => stopReveal.current?.(), []);

  // Only a drawing that takes a moment dims the picture, so quick changes do not flicker.
  useEffect(() => {
    if (!drawing || !picture) {
      setWaiting(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setWaiting(true), 250);
    return () => window.clearTimeout(timer);
  }, [drawing, picture]);

  return (
    <div ref={setStage} className={cn(className, waiting && 'atlas-dungeon-preview--drawing')}>
      <div className="atlas-dungeon-preview__map" style={box ?? undefined} hidden={!box} data-revealing={revealing ?? undefined}>
        {picture ? (
          <>
            <span id={labelId} hidden>{t('dungeon.preview.label')}</span>
            <canvas ref={canvasRef} className="atlas-dungeon-preview__canvas" aria-labelledby={labelId} role="img" />
            <canvas ref={ghost} className="atlas-dungeon-preview__ghost" aria-hidden="true" />
          </>
        ) : (
          <SkeletonGroup label={t('dungeon.preview.label')} className="atlas-dungeon-preview__skeleton">
            <Skeleton className="atlas-dungeon-preview__skeleton-map" />
          </SkeletonGroup>
        )}
        {children}
        {failed && <p className="atlas-dungeon-preview__failed" role="alert">{t('dungeon.preview.failed')}</p>}
      </div>
    </div>
  );
}

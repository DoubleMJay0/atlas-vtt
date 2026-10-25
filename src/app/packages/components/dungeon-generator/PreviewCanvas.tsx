import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Skeleton, SkeletonGroup } from '../primitives/Skeleton';
import { observeResize } from '../../../utils/observeResize';
import { MOTION_EASE_OUT } from '../../../utils/motion';
import { cn } from '../../../../utils/cn';
import { t } from '../../../i18n';
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
}

/** Lays the picture shown on `ghost` and fades it out, so the picture drawn next melts in under it. */
function fadeOut(canvas: HTMLCanvasElement, ghost: HTMLCanvasElement | null): void {
  if (!ghost || canvas.width === 0 || typeof ghost.animate !== 'function') return;
  ghost.width = canvas.width;
  ghost.height = canvas.height;
  ghost.getContext('2d')?.drawImage(canvas, 0, 0);
  const reduced = ghost.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 0 : CROSSFADE_MS, easing: MOTION_EASE_OUT, fill: 'forwards' });
}

/**
 * The drawn map, or its skeleton until the first picture arrived. A picture is held while the
 * next is drawn, so changing a setting never empties the pane, and each new one fades in over
 * the last; while one takes a moment, the picture shown dims a little.
 */
export function PreviewCanvas({ picture, drawing, failed, canvasRef, className }: PreviewCanvasProps): React.JSX.Element {
  const [waiting, setWaiting] = useState(false);
  const shown = useRef<ImageBitmap | null>(null);
  const ghost = useRef<HTMLCanvasElement>(null);
  const labelId = useId();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !picture || shown.current === picture.bitmap) return;
    fadeOut(canvas, ghost.current);
    canvas.width = picture.bitmap.width;
    canvas.height = picture.bitmap.height;
    canvas.getContext('2d')?.drawImage(picture.bitmap, 0, 0);
    shown.current = picture.bitmap;
  }, [picture, canvasRef]);

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
    <div className={cn(className, waiting && 'atlas-dungeon-preview--drawing')}>
      {picture ? (
        <>
          <span id={labelId} hidden>{t('dungeon.preview.label')}</span>
          <span className="atlas-dungeon-preview__pictures">
            <canvas ref={canvasRef} className="atlas-dungeon-preview__canvas" aria-labelledby={labelId} role="img" />
            <canvas ref={ghost} className="atlas-dungeon-preview__ghost" aria-hidden="true" />
          </span>
        </>
      ) : (
        <SkeletonGroup label={t('dungeon.preview.label')} className="atlas-dungeon-preview__skeleton">
          <Skeleton className="atlas-dungeon-preview__skeleton-map" />
        </SkeletonGroup>
      )}
      {failed && <p className="atlas-dungeon-preview__failed" role="alert">{t('dungeon.preview.failed')}</p>}
    </div>
  );
}

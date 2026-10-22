import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '../primitives/LoadingSpinner';
import { Skeleton, SkeletonGroup } from '../primitives/Skeleton';
import { observeResize } from '../../../utils/observeResize';
import { t } from '../../../i18n';
import type { PagePicture } from './usePagePreview';

/** The longest side a preview is drawn at, in device pixels. */
const MAX_PREVIEW_SIDE = 2400;

export interface PreviewSize {
  width: number;
  height: number;
}

/** The device pixels a frame of this many CSS pixels holds, within `MAX_PREVIEW_SIDE`. */
export function previewSizeOf(cssWidth: number, cssHeight: number, ratio: number): PreviewSize | null {
  if (cssWidth < 1 || cssHeight < 1) return null;
  const scale = Math.min(ratio, MAX_PREVIEW_SIDE / Math.max(cssWidth, cssHeight));
  return { width: Math.round(cssWidth * scale), height: Math.round(cssHeight * scale) };
}

/** Measures the frame the page is drawn for; null until it has a size. */
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
  picture: PagePicture | null;
  drawing: boolean;
  failed: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  className?: string;
}

/**
 * The drawn page, or its skeleton until the first picture arrived. A picture is held while the
 * next is drawn, so changing a setting never empties the pane; a small spinner says a newer one
 * is on its way.
 */
export function PreviewCanvas({ picture, drawing, failed, canvasRef, className }: PreviewCanvasProps): React.JSX.Element {
  const [spinner, setSpinner] = useState(false);
  const shown = useRef<ImageBitmap | null>(null);
  const labelId = useId();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !picture || shown.current === picture.bitmap) return;
    canvas.width = picture.width;
    canvas.height = picture.height;
    canvas.getContext('2d')?.drawImage(picture.bitmap, 0, 0);
    shown.current = picture.bitmap;
  }, [picture, canvasRef]);

  // Only a drawing that takes a moment shows the spinner, so quick changes do not flicker.
  useEffect(() => {
    if (!drawing || !picture) {
      setSpinner(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSpinner(true), 250);
    return () => window.clearTimeout(timer);
  }, [drawing, picture]);

  return (
    <div className={className}>
      {picture ? (
        <>
          <span id={labelId} hidden>{t('dungeon.preview.label')}</span>
          <canvas ref={canvasRef} className="atlas-dungeon-preview__canvas" aria-labelledby={labelId} role="img" />
        </>
      ) : (
        <SkeletonGroup label={t('dungeon.preview.label')} className="atlas-dungeon-preview__skeleton">
          <Skeleton shape="text" width="46%" className="atlas-dungeon-preview__skeleton-title" />
          <Skeleton shape="text" width="64%" />
          <Skeleton className="atlas-dungeon-preview__skeleton-map" />
        </SkeletonGroup>
      )}
      {spinner && <LoadingSpinner size={20} className="atlas-dungeon-preview__spinner" />}
      {failed && <p className="atlas-dungeon-preview__failed" role="alert">{t('dungeon.preview.failed')}</p>}
    </div>
  );
}

import React, { useCallback, useRef } from 'react';
import type { DungeonView } from '../../../dungeons/style';
import { useOptionalContextMenu, type ContextMenuEntry } from '../../../react/root/ContextMenuContext';
import { t } from '../../../i18n';
import { mapPointOf, roomAt } from './mapHits';
import { PreviewCanvas } from './PreviewCanvas';
import type { MapPreview as Preview } from './useMapPreview';

interface MapPreviewProps {
  preview: Preview;
  view: Pick<DungeonView, 'secrets'>;
  onFrame: (frame: HTMLDivElement | null) => void;
  /** Hides the secret wing a room lies in. */
  onHideWing: (room: number) => void;
  /** Shows the wings hidden by hand again; unset while none is. */
  onShowHiddenWings?: (() => void) | undefined;
}

/** The map preview; right-click a secret room to hide its wing, or show the hidden wings again. */
export function MapPreview({ preview, view, onFrame, onHideWing, onShowHiddenWings }: MapPreviewProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const menu = useOptionalContextMenu();
  const { picture } = preview;
  const setFrame = useCallback((node: HTMLDivElement | null): void => {
    frameRef.current = node;
    onFrame(node);
  }, [onFrame]);

  const onContextMenu = (event: React.MouseEvent): void => {
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!picture || !canvas || !menu) return;
    const point = mapPointOf({ x: event.clientX, y: event.clientY }, canvas, picture.bitmap.width);
    const room = roomAt(picture.model, view, picture.map, point);
    const entries: ContextMenuEntry[] = [];
    if (room !== null && picture.model.rooms.find((entry) => entry.id === room)?.wing === 'secret') {
      entries.push({ type: 'item', label: t('dungeon.room.hide'), icon: 'eye-off', onClick: () => onHideWing(room) });
    }
    if (onShowHiddenWings) entries.push({ type: 'item', label: t('dungeon.room.showHidden'), icon: 'eye', onClick: onShowHiddenWings });
    if (entries.length === 0) return;
    event.preventDefault();
    menu.open(entries, { x: event.clientX, y: event.clientY }, { returnFocus: frameRef.current });
  };

  return (
    <div ref={setFrame} className="atlas-dungeon-preview" tabIndex={-1} onContextMenu={onContextMenu}>
      <PreviewCanvas picture={picture} drawing={preview.drawing} failed={preview.failed} canvasRef={canvasRef} className="atlas-dungeon-preview__stage" />
    </div>
  );
}

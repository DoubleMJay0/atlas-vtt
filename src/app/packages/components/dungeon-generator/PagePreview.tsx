import React, { useCallback, useRef, useState } from 'react';
import type { NoteEdit } from '../../../dungeons/edits';
import type { Rect } from '../../../dungeons/render/pageText';
import type { NotesMode } from '../../../dungeons/style';
import { useOptionalContextMenu, type ContextMenuEntry } from '../../../react/root/ContextMenuContext';
import { t } from '../../../i18n';
import { clientRectOf, hitPage, manualPlaceOf, pagePointOf, type PagePoint } from './pageHits';
import { PageTextEditor, type PageTextEdit } from './PageTextEditor';
import { PreviewCanvas } from './PreviewCanvas';
import type { PagePreview as Preview } from './usePagePreview';

interface PagePreviewProps {
  preview: Preview;
  notesMode: NotesMode;
  onFrame: (frame: HTMLDivElement | null) => void;
  /** The title typed on the page: an edit of this dungeon, not another dungeon. */
  onTitle: (title: string) => void;
  onStory: (story: string) => void;
  onNote: (room: number, change: NoteEdit | null) => void;
  /** Hides the secret wing a room lies in. */
  onHideWing: (room: number) => void;
  /** Shows the wings hidden by hand again; unset while none is. */
  onShowHiddenWings?: (() => void) | undefined;
}

interface Drag {
  room: number;
  pointerId: number;
  start: PagePoint;
  /** The box as drawn, in client pixels relative to the frame. */
  box: Rect;
  /** Client pixels per page pixel. */
  scale: number;
  dx: number;
  dy: number;
}

/** Moves smaller than this many CSS pixels are clicks. */
const DRAG_THRESHOLD = 3;

/**
 * The page preview and what can be done on it: drag a note's box (Boxes and Tailed), click the
 * title or the story to edit it, and right-click a room or a note for its note's menu.
 */
export function PagePreview({ preview, notesMode, onFrame, onTitle, onStory, onNote, onHideWing, onShowHiddenWings }: PagePreviewProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [edit, setEdit] = useState<PageTextEdit | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const menu = useOptionalContextMenu();
  const { picture } = preview;
  const draggable = notesMode === 'boxes' || notesMode === 'tailed';
  const setFrame = useCallback((node: HTMLDivElement | null): void => {
    frameRef.current = node;
    onFrame(node);
  }, [onFrame]);

  /** The page point under a pointer, and where the canvas lies in the frame. */
  const locate = (client: PagePoint): { point: PagePoint; canvas: DOMRect; frame: DOMRect } | null => {
    const canvas = canvasRef.current?.getBoundingClientRect();
    const frame = frameRef.current?.getBoundingClientRect();
    if (!picture || !canvas || !frame) return null;
    return { point: pagePointOf(client, canvas, picture.width), canvas, frame };
  };

  const inFrame = (rect: Rect, canvas: DOMRect, frame: DOMRect): Rect => {
    const client = clientRectOf(rect, canvas, picture?.width ?? 1);
    return { x: client.x - frame.left, y: client.y - frame.top, w: client.w, h: client.h };
  };

  const noteText = (room: number): string => picture?.model.notes.find((note) => note.room === room)?.text ?? '';
  const noteRef = (room: number): string => picture?.model.notes.find((note) => note.room === room)?.ref ?? '';

  const editNote = (room: number, at: Rect): void => {
    const ref = noteRef(room);
    setEdit({ kind: 'note', room, heading: ref ? t('dungeon.note.heading', { ref }) : t('dungeon.note.add'), value: noteText(room), at });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || edit) return;
    const located = locate({ x: event.clientX, y: event.clientY });
    if (!located || !picture) return;
    const hit = hitPage(picture.layout, located.point);
    if (hit.kind === 'note' && draggable) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const box = inFrame(hit.note.rect, located.canvas, located.frame);
      setDrag({ room: hit.note.room, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, box, scale: located.canvas.width / picture.width, dx: 0, dy: 0 });
    } else if (hit.kind === 'title' || hit.kind === 'story') {
      const at = inFrame(hit.rect, located.canvas, located.frame);
      const value = hit.kind === 'title' ? picture.model.title : picture.model.story;
      setEdit({ kind: hit.kind, heading: t(hit.kind === 'title' ? 'dungeon.name' : 'dungeon.story'), value, at });
    }
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag({ ...drag, dx: event.clientX - drag.start.x, dy: event.clientY - drag.start.y });
  };

  const onPointerUp = (event: React.PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId || !picture) return;
    setDrag(null);
    const moved = Math.hypot(drag.dx, drag.dy) >= DRAG_THRESHOLD;
    const note = picture.layout.notes.find((entry) => entry.room === drag.room);
    if (!note) return;
    if (!moved) {
      editNote(drag.room, drag.box);
      return;
    }
    const centre = { x: note.rect.x + note.rect.w / 2 + drag.dx / drag.scale, y: note.rect.y + note.rect.h / 2 + drag.dy / drag.scale };
    onNote(drag.room, { text: noteText(drag.room), manual: manualPlaceOf(picture.layout, centre) });
  };

  const onContextMenu = (event: React.MouseEvent): void => {
    const located = locate({ x: event.clientX, y: event.clientY });
    if (!located || !picture || !menu) return;
    const hit = hitPage(picture.layout, located.point);
    const room = hit.kind === 'note' ? hit.note.room : hit.kind === 'room' ? hit.room : null;
    const entries: ContextMenuEntry[] = [];
    if (room !== null) {
      const at = { x: event.clientX - located.frame.left, y: event.clientY - located.frame.top, w: 0, h: 0 };
      const hasNote = noteText(room) !== '';
      if (picture.model.rooms.find((entry) => entry.id === room)?.wing === 'secret') {
        entries.push({ type: 'item', label: t('dungeon.room.hide'), icon: 'eye-off', onClick: () => onHideWing(room) });
      }
      entries.push({ type: 'item', label: hasNote ? t('dungeon.note.edit') : t('dungeon.note.add'), icon: hasNote ? 'pencil' : 'plus', onClick: () => editNote(room, at) });
      if (hasNote) entries.push({ type: 'item', label: t('dungeon.note.delete'), icon: 'trash-2', destructive: true, onClick: () => onNote(room, { deleted: true }) });
    }
    if (onShowHiddenWings) entries.push({ type: 'item', label: t('dungeon.room.showHidden'), icon: 'eye', onClick: onShowHiddenWings });
    if (entries.length === 0) return;
    event.preventDefault();
    menu.open(entries, { x: event.clientX, y: event.clientY }, { returnFocus: frameRef.current });
  };

  const commit = (value: string): void => {
    if (!edit) return;
    if (edit.kind === 'title') onTitle(value);
    else if (edit.kind === 'story') onStory(value);
    else if (edit.room !== undefined) onNote(edit.room, value.trim() ? { text: value } : { deleted: true });
    setEdit(null);
  };

  return (
    <div
      ref={setFrame}
      className="atlas-dungeon-preview"
      tabIndex={-1}
      data-dragging={drag ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onContextMenu={onContextMenu}
    >
      <PreviewCanvas picture={picture} drawing={preview.drawing} failed={preview.failed} canvasRef={canvasRef} className="atlas-dungeon-preview__stage" />
      {drag && (
        <div className="atlas-dungeon-preview__ghost" style={{ left: drag.box.x + drag.dx, top: drag.box.y + drag.dy, width: drag.box.w, height: drag.box.h }} />
      )}
      {edit && <PageTextEditor edit={edit} onCommit={commit} onCancel={() => setEdit(null)} />}
    </div>
  );
}

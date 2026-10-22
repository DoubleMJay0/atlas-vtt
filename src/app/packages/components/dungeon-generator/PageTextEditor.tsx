import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../primitives/button';
import { t } from '../../../i18n';
import type { Rect } from '../../../dungeons/render/pageText';

export interface PageTextEdit {
  kind: 'title' | 'story' | 'note';
  /** The note's room. */
  room?: number;
  heading: string;
  value: string;
  /** Where the edited text lies, relative to the preview's frame, in CSS pixels. */
  at: Rect;
}

interface PageTextEditorProps {
  edit: PageTextEdit;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/**
 * Edits a text of the page where it stands: the title in a line, the story and a note in a box.
 * Enter keeps a title, Mod+Enter a longer text; Escape leaves it as it was.
 */
export function PageTextEditor({ edit, onCommit, onCancel }: PageTextEditorProps): React.JSX.Element {
  const [value, setValue] = useState(edit.value);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const headingId = useId();
  const single = edit.kind === 'title';

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.key === 'Enter' && (single || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      onCommit(value);
    }
  };

  const props = {
    ref: field,
    value,
    'aria-labelledby': headingId,
    className: 'atlas-dungeon-text-editor__field',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(event.target.value),
    onKeyDown,
  };

  return (
    <div
      className="atlas-dungeon-text-editor"
      role="dialog"
      aria-labelledby={headingId}
      style={{ left: edit.at.x, top: edit.at.y, minWidth: Math.max(220, edit.at.w) }}
    >
      <span id={headingId} className="atlas-dungeon-text-editor__heading">{edit.heading}</span>
      {single ? <input type="text" {...props} /> : <textarea rows={edit.kind === 'story' ? 4 : 3} placeholder={edit.kind === 'note' ? t('dungeon.note.placeholder') : undefined} {...props} />}
      <div className="atlas-dungeon-text-editor__actions">
        <Button variant="outline" size="sm" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant="default" size="sm" onClick={() => onCommit(value)}>{t('common.save')}</Button>
      </div>
    </div>
  );
}

import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../primitives/button';
import { t } from '../../../i18n';

/** Smallest cell a map PNG is saved with. */
export const MIN_EXPORT_CELL = 10;
/** The cell a map PNG is offered at first, where the map's limits allow it. */
export const DEFAULT_EXPORT_CELL = 70;

interface CellSizeDialogProps {
  /** The largest cell the map's limits allow. */
  max: number;
  onSave: (pxPerCell: number) => void;
  onCancel: () => void;
}

/** Asks the cell size a map PNG is saved with, from `MIN_EXPORT_CELL` to the map's largest. */
export function CellSizeDialog({ max, onSave, onCancel }: CellSizeDialogProps): React.JSX.Element {
  const top = Math.max(MIN_EXPORT_CELL, max);
  const [text, setText] = useState(String(Math.min(DEFAULT_EXPORT_CELL, top)));
  const labelId = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);

  const value = Number(text);
  const valid = Number.isInteger(value) && value >= MIN_EXPORT_CELL && value <= top;
  const save = (): void => { if (valid) onSave(value); };

  return (
    <div className="atlas-dungeon-cell-dialog" role="dialog" aria-labelledby={labelId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); save(); }
      }}>
      <span id={labelId} className="atlas-dungeon-field__label">{t('dungeon.export.cellSize')}</span>
      <div className="atlas-dungeon-cell-dialog__row">
        <input ref={input} type="number" className="atlas-dungeon-field__number" aria-labelledby={labelId} min={MIN_EXPORT_CELL} max={top} step={1}
          value={text} onChange={(event) => setText(event.target.value)} aria-invalid={!valid} />
        <Button variant="ghost" size="sm" onClick={() => setText(String(top))}>{t('dungeon.export.max')}</Button>
      </div>
      <div className="atlas-dungeon-cell-dialog__actions">
        <Button variant="outline" size="sm" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant="default" size="sm" onClick={save} disabled={!valid}>{t('dungeon.export.save')}</Button>
      </div>
    </div>
  );
}

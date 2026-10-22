import React, { useRef } from 'react';
import { ChevronDown, Loader2, Map as MapIcon } from 'lucide-react';
import { Button } from '../primitives/button';
import { useOptionalContextMenu, type ContextMenuEntry } from '../../../react/root/ContextMenuContext';
import { t } from '../../../i18n';
import { CellSizeDialog } from './CellSizeDialog';
import type { DungeonExportKind } from './dungeonExports';
import type { GeneratorActions } from './useGeneratorActions';

interface GeneratorFooterProps {
  actions: GeneratorActions;
  /** Whether a dungeon is there to export. */
  ready: boolean;
  /** The map PNG's cell size is being asked. */
  askingCell: boolean;
  onAskCell: (asking: boolean) => void;
}

/** Status, the Export menu and Create scene. */
export function GeneratorFooter({ actions, ready, askingCell, onAskCell }: GeneratorFooterProps): React.JSX.Element {
  const menu = useOptionalContextMenu();
  const exportButton = useRef<HTMLButtonElement>(null);
  const save = (kind: DungeonExportKind): void => { void actions.exportAs(kind); };

  const openExports = (): void => {
    const button = exportButton.current;
    if (!menu || !button) return;
    const rect = button.getBoundingClientRect();
    const entries: ContextMenuEntry[] = [
      { type: 'item', label: t('dungeon.export.page'), icon: 'file-image', onClick: () => save('page') },
      { type: 'item', label: t('dungeon.export.map'), icon: 'map', onClick: () => onAskCell(true) },
      { type: 'item', label: t('dungeon.export.json'), icon: 'braces', onClick: () => save('json') },
      { type: 'item', label: t('dungeon.export.markdown'), icon: 'file-text', onClick: () => save('markdown') },
    ];
    menu.open(entries, { x: rect.left, y: rect.top - 4 }, { returnFocus: button });
  };

  return (
    <footer className="atlas-dungeon-generator__footer">
      <span className="atlas-dungeon-generator__status" role="status">
        {actions.creating && <><Loader2 className="atlas-spin" aria-hidden="true" />{t('dungeon.creating')}</>}
        {!actions.creating && actions.problem && <span className="atlas-dungeon-generator__problem">{actions.problem}</span>}
      </span>
      <div className="atlas-dungeon-generator__actions">
        <Button ref={exportButton} variant="outline" size="sm" disabled={!ready || actions.creating} onClick={openExports} aria-haspopup="menu">
          <span>{t('dungeon.export')}</span>
          <ChevronDown />
        </Button>
        <Button variant="default" size="sm" disabled={actions.creating} onClick={() => { void actions.create(); }}>
          {actions.creating ? <Loader2 className="atlas-spin" /> : <MapIcon />}
          <span>{t('dungeon.create')}</span>
        </Button>
      </div>
      {askingCell && actions.maxCell !== null && (
        <CellSizeDialog
          max={actions.maxCell}
          onCancel={() => onAskCell(false)}
          onSave={(pxPerCell) => { onAskCell(false); void actions.exportAs('map', pxPerCell); }}
        />
      )}
    </footer>
  );
}

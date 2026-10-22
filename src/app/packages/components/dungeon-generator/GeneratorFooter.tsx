import React, { useRef, useState } from 'react';
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
  /** Whether the GM named it: a scene needs a name. */
  named: boolean;
}

/** Status, the Export menu and Create scene. */
export function GeneratorFooter({ actions, ready, named }: GeneratorFooterProps): React.JSX.Element {
  const menu = useOptionalContextMenu();
  const exportButton = useRef<HTMLButtonElement>(null);
  // The map PNG's cell size is being asked.
  const [askingCell, setAskingCell] = useState(false);
  const save = (kind: DungeonExportKind): void => { void actions.exportAs(kind); };

  const openExports = (): void => {
    const button = exportButton.current;
    if (!menu || !button) return;
    const rect = button.getBoundingClientRect();
    const entries: ContextMenuEntry[] = [
      { type: 'item', label: t('dungeon.export.map'), icon: 'map', onClick: () => setAskingCell(true) },
      { type: 'item', label: t('dungeon.export.svg'), icon: 'file-code', onClick: () => save('svg') },
      { type: 'item', label: t('dungeon.export.json'), icon: 'braces', onClick: () => save('json') },
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
        <Button variant="default" size="sm" disabled={actions.creating || !named} onClick={() => { void actions.create(); }}>
          {actions.creating ? <Loader2 className="atlas-spin" /> : <MapIcon />}
          <span>{t('dungeon.create')}</span>
        </Button>
      </div>
      {askingCell && actions.maxCell !== null && (
        <CellSizeDialog
          max={actions.maxCell}
          onCancel={() => setAskingCell(false)}
          onSave={(options) => { setAskingCell(false); void actions.exportAs('map', options); }}
        />
      )}
    </footer>
  );
}

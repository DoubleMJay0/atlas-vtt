import React from 'react';
import type { CountersBlock, FieldValue, TemplateField } from '../../model/templateTypes';
import type { ShownCounters } from '../../render/blocks/CountersView';
import { CountersGrid } from '../../render/shared/CountersGrid';
import { withCounterUsed } from '../../values/counterValues';
import { usePaneEdit, type PaneEditController } from './paneEditContext';
import { fieldPatches } from './valuePatches';

/** Writes a Counters field as `change` makes it of what it holds now (nothing where it gives null): one patch of the whole value, with the old value as its base. */
async function writeCounters(pane: PaneEditController, field: TemplateField, change: (value: FieldValue | undefined) => FieldValue | null): Promise<void> {
  const read = pane.readFresh(field);
  const next = change(read.value);
  if (next === null) return;
  await pane.write(field, fieldPatches(field.key, read, next), { base: read.value, mine: next });
}

/**
 * A Counters block in the statblock pane: a press on a pip, − or + sets that
 * row's uses, one write of the field. A statblock that showed its template's
 * preset rows gets them as its own with the first change.
 */
function PaneCounters({ block, shown }: { block: CountersBlock; shown: ShownCounters }): React.JSX.Element {
  const pane = usePaneEdit();
  const field = pane.sheet.fields.get(block.field);
  if (!field || !pane.writable) return <CountersGrid {...shown} />;
  const controls = {
    use: (index: number, used: number): void => void writeCounters(pane, field, (value) => withCounterUsed(field, value, index, used)),
  };
  return <CountersGrid {...shown} controls={controls} />;
}

/** The pane's `ValueEditing.counters`. */
export function renderPaneCounters(block: CountersBlock, shown: ShownCounters): React.ReactNode {
  return <PaneCounters block={block} shown={shown} />;
}

import React, { useContext } from 'react';
import { rollStatblockDice, type OffMapRolls } from '../../../services/statblockRolls';
import { RefillButtons, sheetOfferedRefills, sheetRefillTargets } from '../../render/shared/RefillButtons';
import { OffMapRollsContext } from '../../render/shared/offMapRolls';
import { refillSheet, type RegainRoll } from '../../values/counterRefill';
import type { FieldRead } from '../../values/fieldValues';
import { valueText } from '../../values/valueText';
import { usePaneEdit, type PaneEditController } from './paneEditContext';
import { fieldPatches } from './valuePatches';

/** Rolls a regained formula as a roll of the statblock, named by its flavor ("Wand (Dawn)"), where Atlas shows the statblock's rolls. */
function regainRoll(pane: PaneEditController, offMap: OffMapRolls | null): RegainRoll {
  const name = valueText(pane.sheet.reader('name')) || undefined;
  return (formula, flavor) => rollStatblockDice(pane.app, formula, { statblockPath: pane.notePath, tokenName: name, abilityName: flavor }, offMap)?.total ?? null;
}

/**
 * Takes the refill named `name` for the whole sheet: every Counters field's rows it refills get their
 * uses back, those that regain a formula as many as it rolls. Each changed field is one patch, all
 * written together; nothing is written where a roll could not be made.
 */
function takeRefill(pane: PaneEditController, offMap: OffMapRolls | null, name: string): void {
  const reads = new Map<string, FieldRead>();
  const targets = sheetRefillTargets(pane.sheet, (field) => {
    const read = pane.readFresh(field);
    reads.set(field.key, read);
    return read.value;
  });
  const refilled = refillSheet(targets, pane.sheet.refills, pane.sheet.refillNames, name, regainRoll(pane, offMap));
  for (const { field, base, next } of refilled ?? []) {
    const read = reads.get(field.key);
    if (read) void pane.write(field, fieldPatches(field.key, read, next), { base, mine: next });
  }
}

/** The sheet's refill buttons beside the note, under the header: one for each refill the template names that refills one of its counters now. */
function PaneRefills(): React.JSX.Element | null {
  const pane = usePaneEdit();
  const offMap = useContext(OffMapRollsContext);
  const refills = sheetOfferedRefills(pane.sheet, sheetRefillTargets(pane.sheet, (field) => pane.read(field).value));
  return <RefillButtons refills={refills} onRefill={pane.writable ? (name) => takeRefill(pane, offMap, name) : undefined} />;
}

/** The pane's `ValueEditing.refills`. */
export function renderPaneRefills(): React.ReactNode {
  return <PaneRefills />;
}

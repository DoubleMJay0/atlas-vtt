import React, { useContext, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { t } from '../../../i18n';
import { MENU_SEPARATOR, type ContextMenuEntry } from '../../../react/components/context-menu/AtlasContextMenu';
import { characterRestOf, type CharacterRest } from '../../../recovery/characterRest';
import { readableFormula } from '../../../recovery/recoveryFormula';
import type { RecoveryButton } from '../../../recovery/recoveryTypes';
import { restOffers, type RestOffer } from '../../../recovery/restOffer';
import { alwaysRef, type RestRoller, type RuleRef } from '../../../recovery/restTypes';
import type { CounterWriter } from '../../../recovery/restWrites';
import { takeRest } from '../../../recovery/takeRest';
import { rollStatblockDice, type OffMapRolls } from '../../../services/statblockRolls';
import { showNotice } from '../../../ui/notice';
import { OffMapRollsContext } from '../../render/shared/offMapRolls';
import { CardMenuButton } from './CardMenuButton';
import { usePaneEdit, type PaneEditController } from './paneEditContext';
import { usePaneRecoveryContext, type PaneRecovery } from './usePaneRecovery';

/** Rolls a rest's formula as a roll of the statblock, named by its label ("HP (Long rest)"), where Atlas shows the statblock's rolls. */
function paneRoller(pane: PaneEditController, recovery: PaneRecovery, offMap: OffMapRolls | null): RestRoller {
  return (formula, label) => {
    const result = rollStatblockDice(pane.app, formula, { statblockPath: pane.notePath, tokenName: recovery.character.name, abilityName: label }, offMap);
    return result && { formula, total: result.total };
  };
}

/** Writes counters through the pane, so a change the note made meanwhile shows as the pane's conflict. */
function paneCounterWriter(pane: PaneEditController): CounterWriter {
  return async (writes) => {
    await Promise.all(writes.map(({ field, patches, base, next }) => pane.write(field, patches, { base, mine: next })));
    return null;
  };
}

/** The character as it rests now, with the note's values as the pane holds them. */
function restNow(pane: PaneEditController, recovery: PaneRecovery): CharacterRest {
  const { character, templateId, template } = recovery;
  return characterRestOf(pane.app, character, { notePath: pane.notePath, templateId, template, record: pane.record });
}

const hasSpend = (button: RecoveryButton): boolean => button.rules.some((rule) => rule.does === 'spend');

/**
 * A player character's recovery buttons under the statblock's header (D5, R4): a press takes the
 * rest at once; a button that spends something (Hit Dice) first opens a menu with a stepper for
 * each thing it spends, from 0 to what the character holds. What the rest did is said in a notice.
 */
export function PaneRecoveryButtons({ recovery }: { recovery: PaneRecovery }): React.JSX.Element {
  const pane = usePaneEdit();
  const offMap = useContext(OffMapRollsContext);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<RestOffer | null>(null);
  const [counts, setCounts] = useState<readonly number[]>([]);

  const take = async (buttonId: string, spends: ReadonlyMap<RuleRef, number>): Promise<void> => {
    setBusy(true);
    try {
      const taken = await takeRest(pane.app, restNow(pane, recovery), buttonId, { picks: [], spends }, paneRoller(pane, recovery, offMap), paneCounterWriter(pane));
      if (!taken) return;
      const { text } = taken.summary;
      showNotice(taken.problem === null ? text : `${text}\n${t('rest.failed', { problem: taken.problem })}`);
    } finally {
      setBusy(false);
    }
  };

  const opened = (button: RecoveryButton) => (open: boolean): void => {
    if (!open) return;
    const now = restOffers([button], restNow(pane, recovery).character)[0] ?? null;
    setOffer(now);
    setCounts(now?.spends.map(() => 0) ?? []);
  };

  const spendEntries = (button: RecoveryButton): ContextMenuEntry[] => {
    const spends = offer?.id === button.id ? offer.spends : [];
    const count = (index: number): number => counts[index] ?? 0;
    const step = (index: number, by: number) => (): void => {
      setCounts((now) => now.map((value, at) => (at === index ? Math.max(0, Math.min(spends[index]!.max, value + by)) : value)));
    };
    const rows = spends.map((spend, index): ContextMenuEntry => ({
      type: 'item',
      label: spend.label,
      detail: t('rest.spendEach', { each: readableFormula(spend.each) }),
      onClick: step(index, 1),
      keepOpen: true,
      disabled: spend.max === 0,
      stepper: {
        value: t('rest.spendCount', { n: count(index), max: spend.max }),
        label: spend.label,
        onDecrement: step(index, -1),
        onIncrement: step(index, 1),
        canDecrement: count(index) > 0,
      },
    }));
    const choices = new Map(spends.map((spend, index) => [alwaysRef(spend.rule), count(index)]));
    const rest: ContextMenuEntry = { type: 'item', label: t('rest.take'), icon: 'rotate-ccw', onClick: () => take(button.id, choices) };
    return rows.length > 0 ? [...rows, MENU_SEPARATOR, rest] : [rest];
  };

  const content = (button: RecoveryButton): React.ReactNode => (
    <>
      <RotateCcw aria-hidden="true" />
      {button.name}
    </>
  );

  return (
    <div className="atlas-sb-recovery" role="group" aria-label={t('rest.buttons', { name: recovery.character.name })}>
      {recovery.several && <span className="atlas-sb-recovery__who">{recovery.character.name}</span>}
      {recovery.buttons.map((button) => (hasSpend(button)
        ? (
          <CardMenuButton key={button.id} className="atlas-sb-recovery__button" disabled={busy || !pane.writable}
            entries={() => spendEntries(button)} onOpenChange={opened(button)}>
            {content(button)}
          </CardMenuButton>
        )
        : (
          <button key={button.id} type="button" className="atlas-sb-recovery__button" disabled={busy || !pane.writable}
            onClick={() => void take(button.id, new Map())}>
            {content(button)}
          </button>
        )))}
    </div>
  );
}

function PaneRecoverySlot(): React.JSX.Element | null {
  const recovery = usePaneRecoveryContext();
  return recovery ? <PaneRecoveryButtons recovery={recovery} /> : null;
}

/** The pane's `ValueEditing.recovery`. */
export function renderPaneRecovery(): React.ReactNode {
  return <PaneRecoverySlot />;
}

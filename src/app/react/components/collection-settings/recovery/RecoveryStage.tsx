import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { cn } from '../../../../../utils/cn';
import { BlockChromeContext } from '../../../../statblocks/render/blockChrome';
import { StatblockSheet } from '../../../../statblocks/render/StatblockSheet';
import { sampleRecord } from '../../../../statblocks/model/sampleValues';
import type { StatblockTemplate } from '../../../../statblocks/model/templateTypes';
import type { ConditionMetric, SheetMetrics } from '../../../../recovery/editor/recoveryMetrics';
import { metricKey, numberFields } from '../../../../recovery/editor/recoveryMetrics';
import { ruleFor } from '../../../../recovery/editor/recoveryEdits';
import { ruleBadge } from '../../../../recovery/editor/ruleBadge';
import type { RecoveryButton, RecoveryTarget } from '../../../../recovery/recoveryTypes';
import type { ResourceDefinition } from '../../../../resources/resourceTypes';
import { ConditionChips } from './ConditionChips';
import { recoveryChrome, type SpotShared } from './recoveryChrome';
import { RuleCardLayer } from './RuleCardLayer';
import { RuleFan } from './RuleFan';
import { placeRuleFan, type Box } from './rulePlacement';
import type { RuleEditing } from './useRuleEditing';
import { useBoxIn, type Spots } from './useSpots';

interface RecoveryStageProps {
  template: StatblockTemplate;
  name: string;
  metrics: SheetMetrics;
  chips: readonly ConditionMetric[];
  resources: readonly ResourceDefinition[];
  button: RecoveryButton | null;
  buttons: readonly RecoveryButton[];
  editing: RuleEditing;
  spots: Spots;
  /** Picks a spot by id: a click, or Enter on it. */
  onPick: (spotId: string, fromKeyboard: boolean) => void;
  onSpotKey: (spotId: string, event: React.KeyboardEvent) => void;
  /** The spot the Tab key stops at, which also opens the tabs that hold it. */
  active: string | null;
  onActive: (spotId: string) => void;
  /** What a fan may reach over above the stage: the rail and the line under it. */
  bounds: HTMLElement | null;
}

/** The fan's buttons: seven kinds and Remove. */
const FAN_BUTTONS = 8;

/** A metric's own key, field or id: its name where neither the card nor the chips name it. */
function targetName(target: RecoveryTarget): string {
  switch (target.kind) {
    case 'resource': return target.key;
    case 'counters': return target.field;
    case 'condition': return target.id;
  }
}

/** The colour a metric is shown in: its resource's or its condition's; a Counters block has none. */
function targetColor(target: RecoveryTarget, resources: readonly ResourceDefinition[], chips: readonly ConditionMetric[]): string | undefined {
  switch (target.kind) {
    case 'resource': return resources.find((resource) => resource.key === target.key)?.color;
    case 'condition': {
      const key = metricKey(target);
      return chips.find((chip) => metricKey(chip.target) === key)?.color;
    }
    case 'counters': return undefined;
  }
}

/**
 * The template drawn as a statblock with sample values, its metrics dressed as spots through the
 * renderer's chrome, the collection's valued conditions under it, and the fan and card of the
 * picked metric over it.
 */
export function RecoveryStage(props: RecoveryStageProps): React.ReactElement {
  const { template, name, metrics, chips, resources, button, buttons, editing, spots, onPick, onSpotKey, active, onActive, bounds } = props;
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const fields = useMemo(() => sampleRecord(template), [template]);
  const picked = editing.picked;
  const metricBox = useBoxIn(stage, picked ? spots.element(picked.spotId) : null);
  const reach = useBoxIn(stage, bounds);
  // A fan opens over its metric wherever the editor has room above it, the rail included
  const frame: Box | null = stage ? { left: 0, top: Math.min(0, reach?.top ?? 0), right: stage.clientWidth, bottom: stage.clientHeight } : null;
  const fan = metricBox && frame ? placeRuleFan(FAN_BUTTONS, metricBox, frame) : null;

  const nameOf = (target: RecoveryTarget): string => {
    const key = metricKey(target);
    return metrics.metrics.find((metric) => metricKey(metric.target) === key)?.label
      ?? chips.find((chip) => metricKey(chip.target) === key)?.label
      ?? targetName(target);
  };
  const badgeOf = (target: RecoveryTarget): string | null => {
    const rule = button ? ruleFor(button, target) : undefined;
    return rule ? ruleBadge(rule, nameOf) : null;
  };
  const sources = editing.spending && picked
    ? new Set(metrics.metrics.filter((metric) => metricKey(metric.target) !== metricKey(picked.target)).map((metric) => metric.blockId))
    : null;
  const shared: SpotShared = { badgeOf: button?.id ?? '', register: spots.register, onPick, onKeyDown: onSpotKey, onFocus: onActive };
  const chrome = button
    ? recoveryChrome({ metrics, shared, badgeOf: (metric) => badgeOf(metric.target), picked: picked?.spotId ?? null, sources, tabStop: active })
    : null;
  const pickedLabel = picked ? nameOf(picked.target) : '';
  const color = picked ? targetColor(picked.target, resources, chips) : undefined;
  const canSpend = picked !== null && metrics.metrics.some((metric) => metricKey(metric.target) !== metricKey(picked.target));
  const reveal = active !== null && metrics.byBlock.has(active) ? active : null;

  return (
    <div
      ref={setStage}
      className={cn('atlas-rc-stage', button && 'atlas-rc-stage--picking', picked && 'atlas-focused', editing.spending && 'atlas-spending')}
      // A press on the card beside the picked metric puts it down
      onPointerDown={() => { if (picked) editing.closeAll(); }}
    >
      <div className="atlas-rc-sheet">
        <BlockChromeContext.Provider value={chrome}>
          <StatblockSheet template={template} name={name} fields={fields} variant="full" rollBonuses="preview" reveal={reveal} />
        </BlockChromeContext.Provider>
      </div>
      {chips.length > 0 && (
        <ConditionChips chips={chips} shared={shared} badgeOf={(chip) => badgeOf(chip.target)} picked={picked?.spotId ?? null}
          tabStop={active} order={metrics.metrics.length} pickable={button !== null} />
      )}
      <AnimatePresence>
        {editing.fanOpen && picked && fan && button && (
          <RuleFan key={picked.spotId} place={fan} target={picked.target} rule={editing.rule} metric={pickedLabel} button={button.name}
            canSpend={canSpend} focusFirst={editing.fromKeyboard} onChoose={editing.chooseKind} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editing.cardOpen && picked && metricBox && frame && button && (
          <RuleCardLayer key={picked.spotId} metricBox={metricBox} frame={frame} fan={fan} card={{
            rule: editing.rule,
            metric: pickedLabel,
            color,
            button,
            buttons,
            fields: numberFields(template),
            nameOf,
            focusFirst: editing.fromKeyboard,
            onChange: editing.changeRule,
            onPickSource: editing.pickSource,
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}

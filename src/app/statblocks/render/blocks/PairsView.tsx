import React from 'react';
import type { PairsBlock } from '../../model/templateTypes';
import { bonusId, type ArmableValues } from '../../rollBonuses/armableValues';
import { useRollBonusTarget } from '../../rollBonuses/rollBonusContext';
import { formatSigned, numericValue } from '../../values/numberText';
import { normalisePairs, pairName, type Pair } from '../../values/pairValues';
import { valueText } from '../../values/valueText';
import { ArmSwitch } from '../shared/ArmSwitch';
import { InlineText } from '../shared/InlineText';
import { useSheet } from '../sheetContext';
import { LabelledLine } from '../values/LabelledLine';
import { StandIn, ValueText } from '../values/ValueText';
import { ValueSlot } from '../valueSlot';
import type { BlockViewProps } from './blockViewProps';

/** One pair: "Dex +5", the name alone where it has no value ("Stealth"), or the value alone where it has no name. */
function pairText(pair: Pair, signed: boolean): string {
  const number = signed ? numericValue(pair.value) : null;
  const value = (number === null ? valueText(pair.value) : formatSigned(number)).trim();
  const name = pairName(pair.key);
  return [name, value].filter((part) => part !== '').join(' ');
}

interface ArmablePairsProps {
  block: PairsBlock;
  pairs: readonly Pair[];
  signed: boolean;
  armable: ArmableValues;
}

/**
 * The pairs of a block that adds to rolls ("Survival +2, Stealth +1"), each
 * whole number followed by the switch that arms it for the next roll, named
 * after its pair (a Daggerheart Experience, a skill).
 */
function ArmablePairs({ block, pairs, signed, armable }: ArmablePairsProps): React.JSX.Element {
  const { app, sourcePath } = useSheet();
  return (
    <span className="atlas-sb-value">
      {pairs.map((pair, index) => {
        const id = bonusId(block.field, pair.key);
        const value = armable.get(id);
        const text = <InlineText text={pairText(pair, signed)} app={app} sourcePath={sourcePath} dice />;
        return (
          <React.Fragment key={index}>
            {index > 0 && ', '}
            {value ? <span className="atlas-sb-arm-line">{text}<ArmSwitch id={id} label={value.label} /></span> : text}
          </React.Fragment>
        );
      })}
    </span>
  );
}

/** "**Saving Throws** Dex +5, Con +3". */
export function PairsView({ block, display }: BlockViewProps<PairsBlock>): React.JSX.Element {
  const { state } = useSheet();
  const label = block.label ?? state.fields.get(block.field)?.label ?? block.field;
  const signed = block.display === 'signed';
  const value = display.state === 'value' ? state.reader(block.field) : undefined;
  const pairs = normalisePairs(value);
  // A value that holds no pairs shows as it is written.
  const text = pairs.length ? pairs.map((pair) => pairText(pair, signed)).join(', ') : valueText(value);
  const armable = useRollBonusTarget()?.armable;
  const arms = block.addsToRolls === true && armable !== undefined && pairs.some((pair) => armable.has(bonusId(block.field, pair.key)));
  const shown = arms
    ? <ArmablePairs block={block} pairs={pairs} signed={signed} armable={armable} />
    : <ValueText shown={{ text, problems: [] }} />;

  return (
    <LabelledLine label={label} className="atlas-sb-pairs">
      <ValueSlot block={block}>{display.state === 'value' ? shown : <StandIn display={display} />}</ValueSlot>
    </LabelledLine>
  );
}

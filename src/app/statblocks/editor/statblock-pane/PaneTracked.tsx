import React, { useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';
import { t } from '../../../i18n';
import { LabelTooltip } from '../../../packages/components/primitives/tooltip';
import { characterRest } from '../../../recovery/characterRest';
import { writeCharacterResources } from '../../../recovery/restWrites';
import type { ResourceValue } from '../../../resources/resourceTypes';
import type { FieldKey } from '../../model/templateTypes';
import { usePaneEdit } from './paneEditContext';

interface PaneTrackedProps {
  field: FieldKey;
  value: ResourceValue;
  text: React.ReactNode;
}

/**
 * A tracked number beside a player character's note, its current value between − and +: a step is
 * the character's value, written where its resources are kept (its token on an open map, one undo
 * step, else the played campaign's values), never into the note, which holds the maximum. Where
 * nothing keeps the character's values yet the buttons say so and do nothing.
 */
function PaneTracked({ field, value, text }: PaneTrackedProps): React.ReactNode {
  const pane = usePaneEdit();
  const tracked = pane.sheet.tracked.get(field);
  const label = pane.sheet.fields.get(field)?.label || field;
  // Read again with every value shown: a token placed or a campaign played gives the value a home
  const rest = useMemo(() => (tracked ? characterRest(pane.app, pane.notePath) : null), [pane.app, pane.notePath, tracked, value]);
  if (!tracked || !rest) return text;
  const kept = rest.resourcePlace(tracked.key) !== null;
  const step = (by: number): void => {
    const current = Math.max(0, Math.min(value.max, value.current + by));
    if (current !== value.current) writeCharacterResources(pane.app, rest, new Map([[tracked.key, { current, max: value.max }]]));
  };
  const button = (by: number, icon: React.ReactNode, words: string): React.ReactNode => {
    const blocked = !kept || (by < 0 ? value.current <= 0 : value.current >= value.max);
    return (
      <LabelTooltip label={kept ? words : t('statblock.trackedNowhere', { label })}>
        <button type="button" className="atlas-sb-counter__step atlas-sb-tracked__step" aria-disabled={blocked || undefined}
          onClick={() => { if (!blocked) step(by); }}>
          {icon}
        </button>
      </LabelTooltip>
    );
  };
  return (
    <span className="atlas-sb-tracked__stepper">
      {button(-1, <Minus aria-hidden="true" />, t('statblock.decrease', { label }))}
      {text}
      {button(1, <Plus aria-hidden="true" />, t('statblock.increase', { label }))}
    </span>
  );
}

/** The pane's `ValueEditing.tracked`. */
export function renderPaneTracked(field: FieldKey, value: ResourceValue, text: React.ReactNode): React.ReactNode {
  return <PaneTracked field={field} value={value} text={text} />;
}

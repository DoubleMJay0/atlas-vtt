import React, { useId } from 'react';
import { Button } from '../primitives/button';
import { LabelTooltip } from '../primitives/tooltip';
import { TAG_GROUPS, tagKey, type DungeonTag } from '../../../dungeons/tags';
import type { MessageKey } from '../../../i18n/types';
import { t } from '../../../i18n';
import { cn } from '../../../../utils/cn';

interface TagChipsProps {
  /** The tags the shown dungeon is generated with. */
  picked: readonly string[];
  /** Tags the chosen theme cannot take, each with the reason shown as its tooltip. */
  refused: ReadonlyMap<DungeonTag, string>;
  onToggle: (tag: DungeonTag) => void;
  onRandom: () => void;
}

/** A tag's name as shown. */
export function tagName(tag: DungeonTag): string {
  return t(`dungeon.tagName.${tagKey(tag)}` as MessageKey);
}

/** What a tag does, in Atlas' words. */
function tagDescription(tag: DungeonTag): string {
  return t(`dungeon.tag.${tagKey(tag)}` as MessageKey);
}

/**
 * Every tag as a chip that switches it on and off at once, on the same seed, so the map shows
 * what the tag does, grouped under headings (`TAG_GROUPS`); switching one on switches off the
 * tags it rules out. A tag the chosen theme refuses keeps its place, shown off and disabled with
 * the reason as its tooltip, so the chips never move. Random takes a new seed.
 */
export function TagChips({ picked, refused, onToggle, onRandom }: TagChipsProps): React.JSX.Element {
  const labelId = useId();
  return (
    <div className="atlas-dungeon-tags">
      {TAG_GROUPS.map((group) => (
        <div key={group.id} className="atlas-dungeon-tags__group" role="group" aria-labelledby={`${labelId}-${group.id}`}>
          <span id={`${labelId}-${group.id}`} className="atlas-dungeon-tags__label">{t(`dungeon.tagGroup.${group.id}` as MessageKey)}</span>
          <div className="atlas-dungeon-tags__chips">
            {group.tags.map((tag) => {
              const reason = refused.get(tag);
              // A refused tag reads as off: the theme ignores it, though the pick stays for a theme that takes it.
              const on = picked.includes(tag) && reason === undefined;
              return (
                <LabelTooltip key={tag} label={reason ?? tagDescription(tag)} describe>
                  <button
                    type="button"
                    className={cn('atlas-dungeon-tag', on && 'atlas-active', reason !== undefined && 'atlas-dungeon-tag--refused')}
                    aria-pressed={on}
                    aria-disabled={reason !== undefined ? 'true' : undefined}
                    data-tag={tag}
                    onClick={() => {
                      if (reason === undefined) onToggle(tag);
                    }}
                  >
                    {tagName(tag)}
                  </button>
                </LabelTooltip>
              );
            })}
          </div>
        </div>
      ))}
      <div className="atlas-dungeon-tags__actions">
        <LabelTooltip label={t('dungeon.tags.randomHint')} describe>
          <Button variant="secondary" size="sm" onClick={onRandom}>{t('dungeon.tags.random')}</Button>
        </LabelTooltip>
      </div>
    </div>
  );
}

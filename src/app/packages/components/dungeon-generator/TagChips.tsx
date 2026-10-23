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
 * tags it rules out. Random takes a new seed.
 */
export function TagChips({ picked, onToggle, onRandom }: TagChipsProps): React.JSX.Element {
  const labelId = useId();
  return (
    <div className="atlas-dungeon-tags">
      {TAG_GROUPS.map((group) => (
        <div key={group.id} className="atlas-dungeon-tags__group" role="group" aria-labelledby={`${labelId}-${group.id}`}>
          <span id={`${labelId}-${group.id}`} className="atlas-dungeon-tags__label">{t(`dungeon.tagGroup.${group.id}` as MessageKey)}</span>
          <div className="atlas-dungeon-tags__chips">
            {group.tags.map((tag) => {
              const on = picked.includes(tag);
              return (
                <LabelTooltip key={tag} label={tagDescription(tag)} describe>
                  <button
                    type="button"
                    className={cn('atlas-dungeon-tag', on && 'atlas-active')}
                    aria-pressed={on}
                    data-tag={tag}
                    onClick={() => onToggle(tag)}
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

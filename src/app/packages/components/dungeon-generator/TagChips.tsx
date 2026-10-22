import React from 'react';
import { Button } from '../primitives/button';
import { LabelTooltip } from '../primitives/tooltip';
import { DUNGEON_TAGS, tagKey, type DungeonTag } from '../../../dungeons/tags';
import type { MessageKey } from '../../../i18n/types';
import { t } from '../../../i18n';
import { cn } from '../../../../utils/cn';

interface TagChipsProps {
  /** The tags picked; Generate or Random makes them the dungeon's. */
  picked: readonly DungeonTag[];
  /** The tags the shown dungeon was generated with. */
  applied: readonly string[];
  onToggle: (tag: DungeonTag) => void;
  onGenerate: () => void;
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

const sameTags = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((tag) => b.includes(tag));

/**
 * Every tag as a chip that switches it on and off; switching one on switches off the tags it
 * rules out. Picking only stages the tags: Generate keeps the seed, Random takes a new one.
 */
export function TagChips({ picked, applied, onToggle, onGenerate, onRandom }: TagChipsProps): React.JSX.Element {
  const unchanged = sameTags(picked, applied);
  return (
    <div className="atlas-dungeon-tags">
      <div className="atlas-dungeon-tags__chips">
        {DUNGEON_TAGS.map((tag) => {
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
      <div className="atlas-dungeon-tags__actions">
        <LabelTooltip label={t('dungeon.tags.generateHint')} describe>
          <Button variant="secondary" size="sm" onClick={onGenerate} disabled={unchanged}>{t('dungeon.tags.generate')}</Button>
        </LabelTooltip>
        <LabelTooltip label={t('dungeon.tags.randomHint')} describe>
          <Button variant="secondary" size="sm" onClick={onRandom}>{t('dungeon.tags.random')}</Button>
        </LabelTooltip>
      </div>
    </div>
  );
}

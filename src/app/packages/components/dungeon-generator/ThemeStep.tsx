import React, { useRef } from 'react';
import { Castle, Ghost, Mountain, Sparkles, type LucideIcon } from 'lucide-react';
import { THEME_IDS, type ThemeChoice, type ThemeId } from '../../../dungeons/themes/themeTypes';
import { type MessageKey, t } from '../../../i18n';
import { cn } from '../../../../utils/cn';

const ICONS: Readonly<Record<ThemeChoice, LucideIcon>> = { any: Sparkles, fortress: Castle, mansion: Ghost, cavern: Mountain };
const CHOICES: readonly ThemeChoice[] = ['any', ...THEME_IDS];
const STEPS: Readonly<Record<string, 1 | -1>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export const themeName = (theme: ThemeId): string => t(`dungeon.theme.${theme}` as MessageKey);

/** What a theme is, in a few words; for Surprise me, the theme it gave the dungeon shown once it did. */
function themeHint(choice: ThemeChoice, picked: ThemeId | undefined): string {
  if (choice === 'any' && picked) return t('dungeon.theme.anyPicked', { theme: themeName(picked) });
  return t(`dungeon.theme.${choice}.hint` as MessageKey);
}

interface ThemeStepProps {
  value: ThemeChoice;
  /** The theme Surprise me gave the dungeon shown, named on its card while it is chosen. */
  picked: ThemeId | undefined;
  onChange: (theme: ThemeChoice) => void;
}

/**
 * The themes as cards, Surprise me first, one radio group: Tab reaches the chosen card and the
 * arrows choose another at once, so the preview beside the wizard shows each theme in turn.
 */
export function ThemeStep({ value, picked, onChange }: ThemeStepProps): React.JSX.Element {
  const buttons = useRef(new Map<ThemeChoice, HTMLButtonElement>());

  const onKeyDown = (index: number) => (event: React.KeyboardEvent): void => {
    const step = STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = CHOICES[(index + step + CHOICES.length) % CHOICES.length]!;
    onChange(next);
    buttons.current.get(next)?.focus();
  };

  return (
    <div className="atlas-dungeon-themes" role="radiogroup" aria-label={t('dungeon.theme.label')}>
      {CHOICES.map((choice, index) => {
        const Icon = ICONS[choice];
        const chosen = choice === value;
        return (
          <button
            key={choice}
            ref={(button) => {
              if (button) buttons.current.set(choice, button);
              else buttons.current.delete(choice);
            }}
            type="button"
            role="radio"
            aria-checked={chosen}
            tabIndex={chosen ? 0 : -1}
            className={cn('atlas-dungeon-theme', chosen && 'atlas-active')}
            onClick={() => onChange(choice)}
            onKeyDown={onKeyDown(index)}
          >
            <span className="atlas-dungeon-theme__icon" aria-hidden="true"><Icon /></span>
            <span className="atlas-dungeon-theme__name">{choice === 'any' ? t('dungeon.theme.any') : themeName(choice)}</span>
            <span className="atlas-dungeon-theme__hint">{themeHint(choice, chosen ? picked : undefined)}</span>
          </button>
        );
      })}
    </div>
  );
}

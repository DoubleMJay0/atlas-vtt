/** The popover in which the GM types one change for a resource of every selected token. */

import { t } from '../i18n';
import { parseResourceInput } from '../resources/resourceInput';
import { createValueField, openValuePopover, type ValuePopover } from './valuePopover';

export interface SelectionResourceEditorOptions {
  /** Element the point is measured against (the Pixi canvas). */
  anchorEl: HTMLElement;
  /** Where the menu was opened, in client pixels: the popover hangs below it. */
  at: { x: number; y: number };
  resourceName: string;
  /** How many of the selected tokens hold the resource. */
  count: number;
  /** The amount to add to each token's value; negative takes it away. */
  onCommit: (amount: number) => void;
}

/**
 * Opens the popover. It takes only a change, which starts with its sign (`-8`, `+5`, `-9/2` for
 * halved damage: `parseResourceInput`): a number alone would set every token to it, which an
 * area's damage never means, so it is refused.
 */
export function openSelectionResourceEditor({ anchorEl, at, resourceName, count, onCommit }: SelectionResourceEditorOptions): ValuePopover {
  const rect = anchorEl.getBoundingClientRect();
  const label = t('resource.changeSelection', { label: resourceName, count });
  return openValuePopover({
    anchorEl,
    anchor: { x: at.x - rect.left, top: at.y - rect.top, bottom: at.y - rect.top },
    label,
    className: 'atlas-token-value-editor--selection',
    onClose: () => undefined,
    build: (root, close) => {
      root.createSpan({ cls: 'atlas-token-value-editor__label', text: label });
      const input = createValueField(root, t('resource.changeAmount', { label: resourceName }), '', 'atlas-token-value-editor__input--wide');
      input.placeholder = t('resource.changePlaceholder');
      return {
        first: input,
        isDirty: () => input.value.trim() !== '',
        commit: () => {
          const typed = parseResourceInput(input.value);
          input.toggleAttribute('aria-invalid', typed?.relative !== true);
          if (typed?.relative !== true) {
            input.focus();
            return false;
          }
          onCommit(typed.amount);
          close();
          return true;
        },
      };
    },
  });
}

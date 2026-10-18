import { playerName, shownJoinCode } from '../../protocol/index.ts';
import { copyRow, textButton } from './controls.ts';
import { copyText } from './dockDom.ts';
import type { MenuEntry } from './dockMenu.ts';
import type { AddedPlayer } from './panelModel.ts';

/**
 * A question or a field at the foot of the panel or the menu: the GM answers it before anything
 * happens. Kept apart from the DOM, which every redraw replaces, so a change at the table never
 * takes it away.
 */
export type Prompt = ConfirmPrompt | NamePrompt | CodePrompt;

/** `name` is a player's own text; it stands first in the question, in a box of its own. */
interface ConfirmPrompt {
  readonly kind: 'confirm';
  readonly key: string;
  readonly label: string;
  readonly name: string | null;
  readonly text: string;
  readonly confirm: string;
  readonly warning: boolean;
  readonly run: () => void;
}

/** `run` says whether the answer was taken; the field stays open while it was not. */
interface NamePrompt {
  readonly kind: 'name';
  readonly key: string;
  readonly label: string;
  readonly confirm: string;
  draft: string;
  readonly run: (name: string) => boolean;
}

interface CodePrompt {
  readonly kind: 'code';
  readonly player: AddedPlayer;
}

const prompts = new WeakMap<HTMLElement, Prompt>();

export interface LinkActions {
  /** Gives the campaign a new link. */
  newLink(): void;
}

const focusKeyOf = (prompt: Prompt): string => (prompt.kind === 'code' ? 'prompt-done' : `${prompt.key}-${prompt.kind === 'name' ? 'name' : 'confirm'}`);

/** Shows `prompt` on `layer` and puts focus where the answer starts. */
export function openPrompt(layer: HTMLElement, prompt: Prompt, redraw: () => void): void {
  prompts.set(layer, prompt);
  redraw();
  const key = focusKeyOf(prompt);
  Array.from(layer.querySelectorAll<HTMLElement>('[data-focus-key]')).find((el) => el.dataset.focusKey === key)?.focus({ preventScroll: true });
}

export function confirmPrompt(key: string, label: string, text: string, confirm: string, run: () => void, options: { readonly name?: string; readonly warning?: boolean } = {}): Prompt {
  return { kind: 'confirm', key, label, name: options.name ?? null, text, confirm, warning: options.warning === true, run };
}

export function namePrompt(key: string, label: string, confirm: string, draft: string, run: (name: string) => boolean): Prompt {
  return { kind: 'name', key, label, confirm, draft, run };
}

export const codePrompt = (player: AddedPlayer): Prompt => ({ kind: 'code', player });

/** The "New link" row of a link's menu: it asks first, since the old link stops working. */
export function linkEntries(layer: HTMLElement, actions: LinkActions, redraw: () => void): MenuEntry[] {
  const ask = (): void => openPrompt(layer, confirmPrompt('new-link', 'New link', 'The old link stops working. Players need the new one.', 'New link', () => actions.newLink()), redraw);
  return [{ title: 'New link', icon: 'link', run: ask }];
}

/** The prompt `layer` shows, if any, at its foot. */
export function renderPrompt(layer: HTMLElement, redraw: () => void): void {
  const prompt = prompts.get(layer);
  if (prompt === undefined) return;
  const close = (): void => {
    prompts.delete(layer);
    redraw();
  };
  if (prompt.kind === 'confirm') confirmRow(layer, prompt, close);
  else if (prompt.kind === 'name') nameRow(layer, prompt, close);
  else codeRows(layer, prompt.player, close);
}

function confirmRow(layer: HTMLElement, prompt: ConfirmPrompt, close: () => void): void {
  const row = layer.createDiv({ cls: 'atlas-online-confirm', attr: { role: 'group', 'aria-label': prompt.label } });
  const text = row.createSpan({ cls: 'atlas-online-confirm__text' });
  if (prompt.name !== null) text.createEl('bdi', { text: prompt.name });
  text.appendText(prompt.text);
  textButton(row, 'Cancel', close, 'ghost').dataset.focusKey = `${prompt.key}-cancel`;
  const answer = textButton(row, prompt.confirm, () => {
    close();
    prompt.run();
  }, prompt.warning ? 'warning' : 'plain');
  answer.dataset.focusKey = `${prompt.key}-confirm`;
  answer.addClass('atlas-online-corner-button');
}

function nameRow(layer: HTMLElement, prompt: NamePrompt, close: () => void): void {
  const row = layer.createDiv({ cls: 'atlas-online-prompt', attr: { role: 'group', 'aria-label': prompt.label } });
  const field = row.createEl('input', { cls: 'atlas-online-prompt__input', attr: { type: 'text', 'aria-label': 'Name', 'data-focus-key': `${prompt.key}-name` } });
  field.value = prompt.draft;
  textButton(row, 'Cancel', close, 'ghost').dataset.focusKey = `${prompt.key}-cancel`;
  const submit = (): void => {
    const name = playerName(field.value);
    if (name !== null && prompt.run(name)) close();
  };
  const answer = textButton(row, prompt.confirm, submit, 'cta');
  answer.dataset.focusKey = `${prompt.key}-confirm`;
  answer.addClass('atlas-online-corner-button');
  answer.disabled = playerName(field.value) === null;
  field.addEventListener('input', () => {
    prompt.draft = field.value;
    answer.disabled = playerName(field.value) === null;
  });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) submit();
  });
}

/** A new player's code, shown once, with the way to copy it. */
function codeRows(layer: HTMLElement, player: AddedPlayer, close: () => void): void {
  const block = layer.createDiv({ cls: 'atlas-online-prompt atlas-online-prompt--code', attr: { role: 'group', 'aria-label': 'Code of the new player' } });
  const label = block.createDiv({ cls: 'atlas-online-group-label' });
  label.createEl('bdi', { text: player.name });
  label.appendText(' joins with');
  const shown = shownJoinCode(player.code);
  copyRow(block, { icon: 'key-round', text: `Code ${shown}`, copied: 'Code copied', focusKey: 'prompt-copy' }, () => copyText(layer, shown)).addClass('atlas-online-code-row');
  const done = textButton(block, 'Done', close, 'cta');
  done.dataset.focusKey = 'prompt-done';
  done.addClass('atlas-online-corner-button');
}

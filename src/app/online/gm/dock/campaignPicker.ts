import { setIcon } from 'obsidian';
import { scrollWithin } from '../../../utils/scrollWithin';
import { WIDGET_ICON_PATHS, WIDGET_ICON_VIEW_BOX } from '../../../types/widgetIcons';
import type { CampaignChoice } from '../campaignChoices.ts';
import { textButton } from './controls.ts';

/** The campaigns a table can start on, and the one it would start on now. */
export interface CampaignPick {
  /** Null while the campaigns are not read yet. */
  readonly list: readonly CampaignChoice[] | null;
  /** The chosen campaign's id; null while there is none to choose. */
  readonly chosen: string | null;
}

/** What the picker's controls do. */
export interface CampaignPickerActions {
  choose(campaignId: string): void;
  /** Starts the table on the chosen campaign (Enter or a double click on a campaign). */
  start(): void;
  /** Opens Atlas's dashboard, where campaigns are made. */
  openCampaigns(): void;
}

/**
 * The campaign a table would start on: the one the GM picked while it is still there, else the one
 * this device plays, else the one played most recently.
 */
export function campaignPick(list: readonly CampaignChoice[] | null, picked: string | null): CampaignPick {
  const has = (id: string | null): id is string => id !== null && list?.some((campaign) => campaign.id === id) === true;
  const playing = list?.find((campaign) => campaign.playing)?.id ?? null;
  const chosen = has(picked) ? picked : playing ?? list?.[0]?.id ?? null;
  return { list, chosen };
}

function playersText(count: number): string {
  if (count === 0) return 'No players yet';
  if (count === 1) return '1 player';
  return `${count} players`;
}

/** The art of a campaign without a world map, as its dashboard card has it: its own tint and a d20. */
function emblem(parent: HTMLElement, hue: number): void {
  const art = parent.createSpan({ cls: 'campaign-emblem atlas-online-campaign__emblem', attr: { 'aria-hidden': 'true' } });
  art.style.setProperty('--campaign-hue', String(hue));
  const svg = art.createSvg('svg', { cls: 'campaign-emblem__icon', attr: { viewBox: WIDGET_ICON_VIEW_BOX, fill: 'currentColor' } });
  svg.createSvg('path', { attr: { d: WIDGET_ICON_PATHS.d20 } });
}

/** The world map's thumbnail; one the window has decoded before shows at once, a new one fades in. */
function thumbnail(parent: HTMLElement, choice: CampaignChoice): void {
  const frame = parent.createSpan({ cls: 'atlas-online-campaign__art', attr: { 'aria-hidden': 'true' } });
  frame.style.setProperty('--campaign-hue', String(choice.hue));
  if (choice.art === null) return emblem(frame, choice.hue);
  const image = frame.createEl('img', { attr: { src: choice.art, alt: '', decoding: 'async', draggable: 'false' } });
  if (image.complete) image.addClass('is-loaded');
  else image.addEventListener('load', () => image.addClass('is-loaded'), { once: true });
  image.addEventListener('error', () => {
    image.remove();
    emblem(frame, choice.hue);
  }, { once: true });
}

/** Moves the choice with the arrow keys, Home and End, as a radio group does; Enter starts. */
function onKey(event: KeyboardEvent, button: HTMLElement, list: readonly CampaignChoice[], index: number, actions: CampaignPickerActions): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    return actions.start();
  }
  const steps: Partial<Record<string, number>> = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: list.length - 1 };
  const next = steps[event.key];
  if (next === undefined) return;
  event.preventDefault();
  const target = list[Math.max(0, Math.min(list.length - 1, next))];
  if (target === undefined) return;
  // The menu is drawn anew and gives focus back by this key: to the campaign chosen now.
  button.dataset.focusKey = `campaign-${target.id}`;
  actions.choose(target.id);
}

/** The radio of `choice`, the campaign at `index` of `list`; `chosen` says the table starts on it. */
function row(group: HTMLElement, choice: CampaignChoice, chosen: boolean, list: readonly CampaignChoice[], index: number, actions: CampaignPickerActions): HTMLButtonElement {
  const button = group.createEl('button', {
    cls: ['atlas-online-campaign', ...(chosen ? ['is-chosen'] : [])],
    attr: { type: 'button', role: 'radio', 'aria-checked': String(chosen), tabindex: chosen ? '0' : '-1', 'data-focus-key': `campaign-${choice.id}` },
  });
  thumbnail(button, choice);
  const text = button.createSpan({ cls: 'atlas-online-campaign__text' });
  const name = text.createSpan({ cls: 'atlas-online-campaign__name' });
  name.createEl('bdi', { text: choice.name });
  if (choice.playing) name.createSpan({ cls: 'atlas-online-campaign__playing', text: 'Playing' });
  text.createSpan({ cls: 'atlas-online-campaign__meta', text: `${choice.activity} · ${playersText(choice.players)}` });
  const tick = button.createSpan({ cls: 'atlas-online-campaign__tick', attr: { 'aria-hidden': 'true' } });
  setIcon(tick, 'check');
  button.addEventListener('click', () => actions.choose(choice.id));
  button.addEventListener('dblclick', () => actions.start());
  button.addEventListener('keydown', (event) => onKey(event, button, list, index, actions));
  return button;
}

/**
 * The step before a table starts: which campaign it plays. Each campaign shows its world map, name,
 * when it was played and its players; the chosen one is ringed and ticked. A vault without campaigns
 * gets the way to make one.
 */
export function renderCampaignPicker(parent: HTMLElement, pick: CampaignPick, actions: CampaignPickerActions, disabled = false): void {
  const section = parent.createDiv({ cls: 'atlas-online-campaigns' });
  const label = section.createDiv({ cls: 'atlas-online-campaigns__label', text: 'Campaign' });
  label.id = `${parent.id || 'atlas-online'}-campaigns`;
  const list = pick.list;
  if (list === null) {
    section.createDiv({ cls: 'atlas-online-help atlas-online-campaigns__note', text: 'Reading your campaigns…' });
    return;
  }
  if (list.length === 0) {
    section.createDiv({ cls: 'atlas-online-help atlas-online-campaigns__note', text: 'A table plays a campaign: its players come back with their own codes. Make one in the Atlas dashboard.' });
    textButton(section, 'Open dashboard', () => actions.openCampaigns()).dataset.focusKey = 'open-campaigns';
    return;
  }
  const group = section.createDiv({ cls: 'atlas-online-campaigns__list', attr: { role: 'radiogroup', 'aria-labelledby': label.id } });
  list.forEach((choice, index) => {
    row(group, choice, choice.id === pick.chosen, list, index, actions).disabled = disabled;
  });
  // Once drawn: the list is new each time, and starts at its top.
  group.win.requestAnimationFrame(() => {
    const chosen = group.querySelector('.is-chosen');
    if (chosen !== null) scrollWithin(group, chosen, 'nearest');
  });
}

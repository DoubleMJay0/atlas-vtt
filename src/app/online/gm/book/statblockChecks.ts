import { bookLine, MAX_BOOK_TITLE, MAX_SHEET_LIST, type BookStatblock, type SheetField, type SheetNode, type SheetRaw, type SheetValue } from '../../protocol/index.ts';
import type { ResolvedStatblock } from '../../../statblocks/model/resolvedTypes';
import { withHeaderFields } from '../../../statblocks/model/templateHeader';
import type { FieldValue, StatblockTemplate } from '../../../statblocks/model/templateTypes';
import type { NotePatch } from '../../../statblocks/notes/patchTypes';
import { referencesAgree, rollsWithReferences } from '../../../statblocks/values/diceValues';
import type { FieldRead, KeyedField } from '../../../statblocks/values/fieldValues';
import type { FieldLookup } from '../../../statblocks/values/references';
import { fillReferences } from '../../../statblocks/values/fillReferences';
import { fieldsNamedBy } from '../../../statblocks/values/referenceNames';
import { statblockLookup, tracedStatblockLookup } from '../../../statblocks/values/statblockLookup';
import { playerAccess, shownRecord } from './playerAccess.ts';
import type { WrittenValue } from './statblockSheets.ts';

/** What a player's statblock edit is checked against. */
export interface EditInputs {
  /** The note as it is drawn now: read through the resolver, with what was written since. */
  readonly resolved: ResolvedStatblock | null | undefined;
  /** The statblock this player was last sent, whose fields and lists they may change. */
  readonly sent: BookStatblock | null | undefined;
  /** What the note holds of a field now (`StatblockSheets.read`); undefined while it was not read. */
  readonly read: (field: KeyedField) => FieldRead | undefined;
}

/** A checked edit: the patches it is written with, and the values the note holds once they are in. */
export interface CheckedEdit {
  readonly patches: readonly NotePatch[];
  readonly written: readonly WrittenValue[];
}

/** The template of a native note a player may change: its template read as it was written, and a sheet that was sent editable. */
export function editableTemplate(inputs: EditInputs): StatblockTemplate | null {
  const { resolved, sent } = inputs;
  if (!resolved || !sent?.editable || resolved.source.kind !== 'atlas' || resolved.templateStatus !== 'ok') return null;
  return resolved.template;
}

/** The value a field holds once an edit is written under its key, taken from the key the note held it under. */
export function writtenValue(key: string, read: FieldRead, value: FieldValue | undefined): WrittenValue {
  return { key, cleared: read.key === key ? [] : [read.key], value };
}

/** A value that clears its field: its key is deleted, as the note pane does. */
export const clears = (value: SheetRaw): boolean => value === null || value === '' || (Array.isArray(value) && value.length === 0);

/** A line as a page writes it: already one clean line within a title's length. */
export const isLine = (value: unknown): value is string => typeof value === 'string' && bookLine(value, MAX_BOOK_TITLE) === value;

export const isScalar = (value: SheetRaw | undefined): value is string | number | boolean | null => value === null || typeof value !== 'object';

/** What a player's `@` references are checked against (`playerReferences`). */
export interface PlayerReferences {
  /** The numbers they read: the card's lookup over the values the player may see (`shownRecord`), as their sheet's references are worked out. */
  readonly lookup: FieldLookup;
  /**
   * Whether a text the player wrote names nothing hidden from them: no reference may name a hidden
   * field by any name the lookup reads (`fieldsNamedBy`), even one the note holds nothing of now,
   * and each must read the same field over the values they may see as over the whole note
   * (`referencesAgree`), so whatever fills it in for the GM reads what the player was shown.
   */
  safe(text: string): boolean;
}

/** The paths a text's references may read, each `@` with every shorter path the lookup tries after its whole one. */
function referencePaths(text: string): string[] {
  const paths: string[] = [];
  fillReferences(text, (path) => {
    paths.push(path);
    return undefined;
  });
  return paths;
}

/** What a player's `@` references read, and whether one they wrote names only what they may see. */
export function playerReferences(inputs: EditInputs, template: StatblockTemplate): PlayerReferences {
  const { fields } = withHeaderFields(template);
  const record = inputs.resolved?.fields ?? {};
  const shown = shownRecord(record, template, fields);
  const seen = tracedStatblockLookup(template, shown, fields);
  const all = tracedStatblockLookup(template, record, fields);
  const hidden = (path: string): boolean => fieldsNamedBy(fields, path.split('.')[0] ?? '').some((field) => playerAccess(template, field.key) === 'hidden');
  return {
    lookup: statblockLookup(template, shown, fields),
    safe: (text) => !referencePaths(text).some(hidden) && referencesAgree(text, seen, all),
  };
}

/** Whether every text a player wrote into a value, at any depth, names nothing hidden from them (`PlayerReferences.safe`). */
export function referencesSafeIn(value: unknown, references: PlayerReferences): boolean {
  if (typeof value === 'string') return references.safe(value);
  if (Array.isArray(value)) return value.every((item: unknown) => referencesSafeIn(item, references));
  if (value === null || typeof value !== 'object') return true;
  return Object.values(value).every((item: unknown) => referencesSafeIn(item, references));
}

/**
 * Dice a line writes, which Atlas rolls once its references are filled in from what the player may
 * see (`playerReferences`). A reference that names no number there, or anything hidden from them,
 * refuses it; the text is stored as written.
 */
export const isDice = (value: unknown, references: PlayerReferences): value is string =>
  isLine(value) && rollsWithReferences(value, references.lookup) && references.safe(value);

/** Several options in the options' order, each once; an open choice may name others after them. */
export function inOptionOrder(value: SheetRaw, options: readonly string[], open: boolean): value is readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_SHEET_LIST) return false;
  let last = -1;
  let own = false;
  const seen = new Set<string>();
  for (const pick of value) {
    if (!isLine(pick) || seen.has(pick)) return false;
    seen.add(pick);
    const at = options.indexOf(pick);
    if (at < 0 ? !open : own || at <= last) return false;
    if (at < 0) own = true;
    else last = at;
  }
  return true;
}

/** One option of a choice, or what the player wrote where the choice is open or has no options. */
export const amongOptions = (value: SheetRaw, options: readonly string[] | undefined, open: boolean): boolean =>
  isLine(value) && (open || options === undefined || options.length === 0 || options.includes(value));

/** A list of plain values, each a line or a number. */
export const isPlainList = (value: SheetRaw): value is readonly (string | number)[] =>
  Array.isArray(value) && value.length <= MAX_SHEET_LIST && value.every((item: SheetRaw) => isLine(item) || typeof item === 'number');

/** Every value of a sent statblock the player may change, wherever the sheet shows it. */
export function sentFields(statblock: BookStatblock): SheetField[] {
  const fields: SheetField[] = [];
  const ofValue = (value: SheetValue | undefined): void => void (value?.field && fields.push(value.field));
  const walk = (nodes: readonly SheetNode[]): void => {
    for (const node of nodes) {
      if (node.k === 'section' || node.k === 'row') walk(node.nodes);
      else if (node.k === 'tabs') for (const tab of node.tabs) walk(tab.nodes);
      else if (node.k === 'value') ofValue(node.value);
      else if (node.k === 'metric') node.values.forEach(ofValue);
      else if ((node.k === 'table' || node.k === 'track' || node.k === 'counters') && node.field !== null) fields.push(node.field);
    }
  };
  Object.values(statblock.sigils).forEach(ofValue);
  walk(statblock.blocks);
  return fields;
}


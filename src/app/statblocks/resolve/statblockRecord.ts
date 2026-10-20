/**
 * A statblock note's fields as tokens read them (resources, initiative): the
 * resolver's fields with the note's own frontmatter, and the meanings and
 * labels of its template.
 */

import { TFile, type App } from 'obsidian';
import { boundedFields } from '../../creatures/statblockValues';
import { labelsOf, type FieldLabels } from '../../initiative/modifierFields';
import { isBestiaryResolved } from '../../services/FantasyStatblocksService';
import type { ResolvedStatblock } from '../model/resolvedTypes';
import { NO_MEANINGS, type FieldMeanings } from './fieldMeanings';
import { readStatblock } from './readStatblock';

export interface StatblockRecord {
  /** The statblock's fields as the resolver gives them, with the note's frontmatter (`recordOf`). */
  record: Record<string, unknown>;
  /** What the fields of the statblock's template mean (hit points, rating under other keys). */
  meanings: FieldMeanings;
  /** The labels of its template's fields, to their keys; none for Fantasy Statblocks' statblocks. */
  labels: FieldLabels;
  /** A statblock Fantasy Statblocks defines (frontmatter or fence), not an Atlas template. */
  fantasy: boolean;
}

const NO_LABELS: FieldLabels = Object.freeze({});

/**
 * The fields and the note's frontmatter as one record. A fence's statblock is its YAML, and the
 * frontmatter around it is the note's (aliases, tags, a `level` of its own): the statblock wins
 * every key both hold. Frontmatter statblocks are the frontmatter, which the bestiary's copy may
 * lag behind: there the frontmatter wins.
 */
export function recordOf(statblock: Pick<ResolvedStatblock, 'fields' | 'source'> | null, frontmatter: Record<string, unknown> | undefined): Record<string, unknown> {
  return statblock?.source.kind === 'fs-fence' ? { ...frontmatter, ...statblock.fields } : { ...statblock?.fields, ...frontmatter };
}

/**
 * The record of a statblock note; null where the note is none. While Fantasy Statblocks
 * still parses the vault, a creature read by name is not there yet and one that extends
 * another comes without it: with `wholeOnly` such a statblock gives null.
 */
export async function readStatblockRecord(app: App, statblockPath: string, wholeOnly = false): Promise<StatblockRecord | null> {
  const file = app.vault.getAbstractFileByPath(statblockPath);
  if (!(file instanceof TFile)) return null;

  const noted: unknown = app.metadataCache.getFileCache(file)?.frontmatter;
  const frontmatter = noted ? boundedFields(noted) : undefined;
  // Asked before the read: a parse that ends meanwhile does not make what was read whole.
  const parsing = !isBestiaryResolved();
  const statblock = await readStatblock(app, statblockPath);
  if (!frontmatter && !statblock) return null;
  if (wholeOnly && parsing && (!statblock || statblock.fields.extends !== undefined)) return null;
  return {
    record: recordOf(statblock, frontmatter),
    meanings: statblock?.meanings ?? NO_MEANINGS,
    labels: statblock?.template && statblock.source.kind === 'atlas' ? labelsOf(statblock.template.fields) : NO_LABELS,
    fantasy: statblock !== null && statblock.source.kind !== 'atlas',
  };
}

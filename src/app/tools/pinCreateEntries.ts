import type { App } from 'obsidian';
import { t } from '../i18n';
import { INVALID_NAME_CHARACTERS, collectionIdOfPath } from '../services/assetPaths';
import { openDungeonGenerator } from '../packages/components/dungeon-generator/openDungeonGenerator';
import { freeNotePath } from '../utils/notePaths';

/**
 * A way to make what a name typed into the note pin search names, offered
 * above the results while no file carries that name.
 */
export interface PinCreateEntry {
  id: string;
  /** The entry's text for the typed name. */
  label: (name: string) => string;
  /** A Lucide icon id. */
  icon: string;
  /** Why `name` cannot be used, shown under a disabled entry; null where it can. */
  problem?: (name: string) => string | null;
  /** Makes it and returns the vault path the pin links, or null when the GM cancelled. */
  create: (name: string) => Promise<string | null>;
}

/** Why `name` cannot name a note, or null when it can. */
export function noteNameProblem(name: string): string | null {
  if (INVALID_NAME_CHARACTERS.test(name)) return t('pin.search.invalidName');
  if (name.startsWith('.')) return t('pin.search.dotName');
  return null;
}

/**
 * Creates an empty note of the typed name in Obsidian's folder for new notes
 * (as seen from the map), numbered when the name is taken there.
 */
export function noteCreateEntry(app: App, mapPath: string | null): PinCreateEntry {
  return {
    id: 'note',
    label: (name) => t('pin.search.createNote', { name }),
    icon: 'file-plus',
    problem: noteNameProblem,
    create: async (name) => {
      const folder = app.fileManager.getNewFileParent(mapPath ?? '');
      const file = await app.vault.create(freeNotePath(app, folder, name), '');
      return file.path;
    },
  };
}

/**
 * Generates a dungeon of the typed name as a scene of the map's own collection (a pin links only
 * scenes of its collection), and links the pin to it. Offered only on a map in a collection.
 */
export function dungeonCreateEntry(app: App, mapPath: string | null): PinCreateEntry | null {
  const collectionId = collectionIdOfPath(mapPath);
  if (!collectionId) return null;
  return {
    id: 'dungeon',
    label: (name) => t('pin.search.generateDungeon', { name }),
    icon: 'castle',
    create: async (name) => (await openDungeonGenerator(app, { name, collectionId }))?.scenePath ?? null,
  };
}

import type { App } from 'obsidian';
import { GM_LEVEL, readLevel } from '../protocol/index.ts';

/** Device-local: the least GM level the relay last asked for. */
const MIN_LEVEL_KEY = 'atlas-vtt:online-min-level';

export const OUTDATED_TEXT = 'Online play needs a newer Atlas.';
export const UPDATE_AFTER_TEXT = 'Update Atlas after this session';

/** Keeps what the relay last said it needs, from a welcome, a refused table or a refused hello. */
export function rememberMinLevel(app: App, level: number): void {
  app.saveLocalStorage(MIN_LEVEL_KEY, level);
}

export function knownMinLevel(app: App): number {
  return readLevel(app.loadLocalStorage(MIN_LEVEL_KEY));
}

/** Whether the relay asked for more than this Atlas serves; an updated Atlas reads false at once. */
export function isOutdated(app: App): boolean {
  return knownMinLevel(app) > GM_LEVEL;
}

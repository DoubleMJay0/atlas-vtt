import { STYLE_PRESETS, type GridStyle, type NotesMode, type StylePresetId } from '../../../dungeons/style';
import type { DungeonShortcut } from './dungeonShortcuts';
import type { DungeonState } from './useDungeonState';

const PRESET_ORDER = Object.keys(STYLE_PRESETS) as StylePresetId[];
/** The grid styles Shift+G steps through. */
const DRAWN_GRIDS: readonly Exclude<GridStyle, 'off'>[] = ['dotted', 'dashed', 'solid', 'broken'];
/** What N steps through; a mode outside the cycle starts it again. */
const NOTES_CYCLE: readonly NotesMode[] = ['boxes', 'tailed', 'legend', 'off'];

export interface ShortcutHandlers {
  focusTags: () => void;
  focusStyle: () => void;
  savePage: () => void;
  exportMap: () => void;
  saveJson: () => void;
  /** The grid style G switches back on. */
  lastGrid: { current: Exclude<GridStyle, 'off'> };
}

/** The next water level of Shift+W: a tenth higher, back to none after full. */
export function raisedWaterLevel(level: number | undefined): number {
  const next = Math.round(((level ?? 0) + 0.1) * 10) / 10;
  return next > 1 ? 0 : next;
}

export function nextNotesMode(mode: NotesMode): NotesMode {
  const at = NOTES_CYCLE.indexOf(mode);
  return at < 0 ? 'boxes' : NOTES_CYCLE[(at + 1) % NOTES_CYCLE.length]!;
}

/** Does what a shortcut asks for. */
export function runShortcut(shortcut: DungeonShortcut, state: DungeonState, handlers: ShortcutHandlers): void {
  const { view } = state.settings;
  const toggle = (key: 'rotateToFit' | 'secrets' | 'monochrome' | 'water' | 'props'): void => state.setView({ [key]: !view[key] });
  switch (shortcut.kind) {
    case 'new': return state.newSeed();
    case 'tags': return handlers.focusTags();
    case 'style': return handlers.focusStyle();
    case 'preset': {
      const preset = PRESET_ORDER[shortcut.index];
      if (preset) state.applyPreset(preset);
      return;
    }
    case 'rearrange': return state.rearrangeNotes();
    case 'rerollNotes': return state.rerollNotes();
    case 'cycleNotes': return state.setView({ notes: nextNotesMode(view.notes) });
    case 'legend': return state.setView({ notes: view.notes === 'legend' ? 'boxes' : 'legend' });
    case 'rotate': return toggle('rotateToFit');
    case 'secrets': return toggle('secrets');
    case 'monochrome': return toggle('monochrome');
    case 'water': return toggle('water');
    case 'props': return toggle('props');
    case 'grid':
      if (view.grid !== 'off') handlers.lastGrid.current = view.grid;
      return state.setView({ grid: view.grid === 'off' ? handlers.lastGrid.current : 'off' });
    case 'gridStyle': {
      const at = view.grid === 'off' ? -1 : DRAWN_GRIDS.indexOf(view.grid);
      const grid = DRAWN_GRIDS[(at + 1) % DRAWN_GRIDS.length]!;
      handlers.lastGrid.current = grid;
      return state.setView({ grid });
    }
    case 'smallTiles': return state.setView({ smallTiles: shortcut.on });
    case 'raiseWater': return state.setWaterLevel(raisedWaterLevel(state.request.waterLevel));
    case 'savePage': return handlers.savePage();
    case 'exportMap': return handlers.exportMap();
    case 'json': return handlers.saveJson();
  }
}

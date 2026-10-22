import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { App } from 'obsidian';
import { applyDungeonEdits, NO_EDITS, withNoteEdit, withoutManualPlaces, type DungeonEdits, type NoteEdit } from '../../../dungeons/edits';
import { DEFAULT_DUNGEON_GENERATOR_SETTINGS, type DungeonGeneratorSettings } from '../../../dungeons/generatorSettings';
import type { DungeonModel, DungeonRequest } from '../../../dungeons/model';
import { randomSeed } from '../../../dungeons/rng';
import { STYLE_PRESETS, type DungeonStyle, type DungeonView, type StylePresetId } from '../../../dungeons/style';
import { withTag, type DungeonTag } from '../../../dungeons/tags';
import { SettingsService } from '../../../services/SettingsService';

/** Everything the generator panel holds and how it changes. */
export interface DungeonState {
  request: DungeonRequest;
  /** Tags picked but not yet generated with (Generate and Random apply them). */
  draftTags: DungeonTag[];
  settings: DungeonGeneratorSettings;
  edits: DungeonEdits;
  /** The generated dungeon of the current request, before the GM's edits; null until it arrived. */
  generated: DungeonModel | null;
  /** The dungeon as shown: the generated one with the GM's edits. */
  model: DungeonModel | null;
  setGenerated: (request: DungeonRequest, model: DungeonModel) => void;
  setName: (name: string) => void;
  setSeed: (seed: number) => void;
  /** New dungeon: a new seed, the tags as they are. */
  newSeed: () => void;
  toggleDraftTag: (tag: DungeonTag) => void;
  /** The picked tags, this seed. */
  generate: () => void;
  /** The picked tags, a new seed. */
  random: () => void;
  setWaterLevel: (level: number | undefined) => void;
  setView: (changes: Partial<DungeonView>) => void;
  setStyle: (style: DungeonStyle) => void;
  applyPreset: (preset: StylePresetId) => void;
  editNote: (room: number, change: NoteEdit | null) => void;
  editStory: (story: string) => void;
  /** Lets every note box find its own place again. */
  rearrangeNotes: () => void;
}

function readSettings(app: App): DungeonGeneratorSettings {
  return SettingsService.forApp(app)?.getDungeonGenerator() ?? DEFAULT_DUNGEON_GENERATOR_SETTINGS;
}

const sameTags = (a: readonly DungeonTag[], b: readonly DungeonTag[]): boolean => a.length === b.length && a.every((tag) => b.includes(tag));

/**
 * The generator's state. Style, view and the tags generated with are the GM's preferences and
 * kept in Atlas' settings as they change; the seed, the name and the edits belong to this one
 * dungeon and go with the panel. A new seed, name or tags is another dungeon: edits are dropped.
 */
export function useDungeonState(app: App, initialName = ''): DungeonState {
  const [settings, setSettings] = useState<DungeonGeneratorSettings>(() => readSettings(app));
  const [request, setRequest] = useState<DungeonRequest>(() => ({
    seed: randomSeed(),
    tags: settings.tags,
    ...(initialName.trim() ? { name: initialName.trim() } : {}),
  }));
  const [draftTags, setDraftTags] = useState<DungeonTag[]>(settings.tags);
  const [edits, setEdits] = useState<DungeonEdits>(NO_EDITS);
  const [generated, setGeneratedState] = useState<{ request: DungeonRequest; model: DungeonModel } | null>(null);
  // Ahead of the render, so changes made one after the other build on each other.
  const settingsRef = useRef(settings);

  const persist = useCallback((changes: Partial<DungeonGeneratorSettings>): void => {
    settingsRef.current = { ...settingsRef.current, ...changes };
    setSettings(settingsRef.current);
    SettingsService.forApp(app)?.setDungeonGenerator(changes);
  }, [app]);


  // A request is another dungeon: what was edited on the last one does not fit it.
  const changeRequest = useCallback((change: (current: DungeonRequest) => DungeonRequest): void => {
    setRequest((current) => change(current));
    setEdits(NO_EDITS);
  }, []);

  const applyTags = useCallback((tags: DungeonTag[], seed?: number): void => {
    changeRequest((current) => ({ ...current, tags, ...(seed === undefined ? {} : { seed }) }));
    persist({ tags });
  }, [changeRequest, persist]);

  // The settings may change elsewhere (another device, another generator): follow them.
  useEffect(() => SettingsService.forApp(app)?.onChange(() => {
    const next = readSettings(app);
    if (JSON.stringify(next) === JSON.stringify(settingsRef.current)) return;
    settingsRef.current = next;
    setSettings(next);
  }), [app]);

  const model = useMemo(() => {
    if (!generated || generated.request !== request) return null;
    return applyDungeonEdits(generated.model, edits);
  }, [generated, request, edits]);

  return {
    request,
    draftTags,
    settings,
    edits,
    generated: generated?.request === request ? generated.model : null,
    model,
    setGenerated: useCallback((asked, next) => setGeneratedState({ request: asked, model: next }), []),
    setName: useCallback((name) => changeRequest((current) => {
      const trimmed = name.trim();
      if ((current.name ?? '') === trimmed) return current;
      const { name: _old, ...rest } = current;
      return trimmed ? { ...rest, name: trimmed } : rest;
    }), [changeRequest]),
    setSeed: useCallback((seed) => changeRequest((current) => (current.seed === seed ? current : { ...current, seed })), [changeRequest]),
    newSeed: useCallback(() => changeRequest((current) => ({ ...current, seed: randomSeed() })), [changeRequest]),
    toggleDraftTag: useCallback((tag) => setDraftTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : withTag(tags, tag))), []),
    generate: useCallback(() => {
      if (!sameTags(draftTags, request.tags as DungeonTag[])) applyTags(draftTags);
    }, [applyTags, draftTags, request.tags]),
    random: useCallback(() => applyTags(draftTags, randomSeed()), [applyTags, draftTags]),
    setWaterLevel: useCallback((level) => setRequest((current) => {
      const { waterLevel: _old, ...rest } = current;
      return level === undefined ? rest : { ...rest, waterLevel: level };
    }), []),
    setView: useCallback((changes) => persist({ view: { ...settingsRef.current.view, ...changes } }), [persist]),
    setStyle: useCallback((style) => persist({ style, preset: 'custom' }), [persist]),
    applyPreset: useCallback((preset) => persist({ style: STYLE_PRESETS[preset], preset }), [persist]),
    editNote: useCallback((room, change) => setEdits((current) => withNoteEdit(current, room, change)), []),
    editStory: useCallback((story) => setEdits((current) => ({ ...current, story })), []),
    rearrangeNotes: useCallback(() => setEdits(withoutManualPlaces), []),
  };
}

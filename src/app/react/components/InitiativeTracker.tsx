import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { openContextMenuGlobal } from '../root/ContextMenuContext';
import { useAtlasStore, useViewStoreHook } from '../ViewStoreContext';
import { useAtlasUI } from '../root/AtlasUIContext';
import { useAtlasSettings } from '../../keyboard/useMapHotkeys';
import { useNumberEditing } from './useNumberEditing';
import { listedByCards, listedBySides, listedSides } from '../../initiative/sides';
import { useStartCombat } from './useStartCombat';
import { defeatedCombatants } from '../../initiative/defeated';
import { useMapResources } from '../../resources/useMapResources';
import { useInitiativeTokenSync } from '../../initiative/useInitiativeTokenSync';
import { useMapInitiativeRules } from '../../initiative/useMapInitiativeRules';
import { useInitiativeRolls } from '../../initiative/useInitiativeRolls';
import { scrollWithin } from '../../utils/scrollWithin';
import { useEditInitiativePopup } from './useEditInitiativePopup';
import { InitiativeCard } from './InitiativeCard';
import { useInitiativeCardMenu } from './useInitiativeCardMenu';
import { initiativeTrackerOptions } from './initiativeTrackerOptions';
import { InitiativeTrackerList } from './InitiativeTrackerList';
import { InitiativeTrackerControls } from './InitiativeTrackerControls';
import { InitiativeTurnControls } from './InitiativeTurnControls';
import { useStatblockHoverPreview } from './StatblockHoverPreview';
import { InitiativeStatblockPreview, type PreviewedEntry } from './InitiativeStatblockPreview';
import { captureRollContext } from '../../tools/diceRollOrigins';
import type { InitiativeEntry } from '../../types/initiativeTypes';
import './initiative-tracker.scss';

/**
 * Initiative Tracker Panel
 * Modern minimal design with floating cards. The GM chooses the combatants from the token menu;
 * the players' list (`PlayerInitiativePanel`) shows the same ones, without those whose token is hidden.
 * The collection's initiative rules decide whether they act in turn order or by sides.
 */
export const InitiativeTracker: React.FC = () => {
  const { app, view } = useAtlasUI();
  const settings = useAtlasSettings();
  const showNames = settings?.showsInitiativeNames() ?? false;

  // Store state
  const isOpen = useAtlasStore((s) => s.initiativeTrackerOpen);
  const initiative = useAtlasStore((s) => s.initiative);
  const tokens = useAtlasStore((s) => s.objects?.tokens) || {};
  const mapPath = useAtlasStore((s) => s.mapPath);
  const mapLoaded = useAtlasStore((s) => s.mapLoaded);
  const isMapLoading = useAtlasStore((s) => s.isMapLoading);
  const rules = useMapInitiativeRules();
  const { roll, rolling } = useInitiativeRolls(app, rules);
  const bySides = listedBySides(initiative, rules);
  const byCards = listedByCards(initiative, rules);
  const sides = useMemo(() => listedSides(initiative, rules), [initiative, rules]);

  // Store actions
  const nextTurn = useAtlasStore((s) => s.nextTurn);
  const previousTurn = useAtlasStore((s) => s.previousTurn);
  const reorderInitiative = useAtlasStore((s) => s.reorderInitiative);
  const endCombat = useAtlasStore((s) => s.endCombat);
  const updateInitiativeEntry = useAtlasStore((s) => s.updateInitiativeEntry);
  const resetInitiative = useAtlasStore((s) => s.resetInitiative);
  const setInitiativeConfig = useAtlasStore((s) => s.setInitiativeConfig);

  // Turns pass defeated combatants by, as their cards show them now
  const store = useViewStoreHook();
  const definitions = useMapResources();
  const defeated = useCallback((): ReadonlySet<string> => {
    const { initiative: current, objects } = store.getState();
    return defeatedCombatants(current.entries, objects.tokens, definitions);
  }, [store, definitions]);
  const startCombat = useStartCombat(rules, defeated);

  // Local state
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { open: openEditPopup, popup: editPopup } = useEditInitiativePopup(updateInitiativeEntry);

  // The turn stays in view in a list longer than the panel: the combatant's card, or the top of its side
  const contentRef = useRef<HTMLDivElement>(null);
  const turnOf = initiative.sides?.active ?? initiative.entries.find((entry) => entry.isActive)?.id;
  useEffect(() => {
    const content = contentRef.current;
    if (!initiative.isActive || !content) return;
    const side = content.querySelector('.atlas-initiative-side--active');
    const card = content.querySelector('.atlas-initiative-card--active');
    if (side) scrollWithin(content, side, 'start');
    else if (card) scrollWithin(content, card, 'nearest');
  }, [initiative.isActive, turnOf, initiative.round]);

  // Use shared statblock hover preview hook
  const [previewState, previewActions] = useStatblockHoverPreview<PreviewedEntry>({ app });

  useInitiativeTokenSync(tokens, initiative.entries);

  // Sorted entries by order
  const sortedEntries = useMemo(() => {
    return [...initiative.entries].sort((a, b) => a.order - b.order);
  }, [initiative.entries]);

  // Numbers typed on the cards; Tab goes on down the list as it shows, the delayed below the order
  const shownOrder = useMemo(
    () => [...sortedEntries.filter((entry) => !entry.delayed), ...sortedEntries.filter((entry) => entry.delayed)],
    [sortedEntries],
  );
  const numberEditing = useNumberEditing(shownOrder, updateInitiativeEntry);

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number): void => {
    setDragFromIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number): void => {
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback((): void => {
    if (dragFromIndex !== null && dragOverIndex !== null && dragFromIndex !== dragOverIndex) {
      reorderInitiative(dragFromIndex, dragOverIndex);
    }
    setDragFromIndex(null);
    setDragOverIndex(null);
  }, [dragFromIndex, dragOverIndex, reorderInitiative]);

  const handleContextMenu = useInitiativeCardMenu({ tokens, bySides, sides, cards: initiative.cards !== undefined, fightRuns: initiative.isActive, roll, defeated, edit: openEditPopup });

  const openOptions = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const entries = initiativeTrackerOptions(
      // Cards keep the order they were dealt in, so the Auto sort switch is disabled there as by sides
      { autoSort: initiative.config.autoSort, bySides: bySides || byCards, empty: initiative.entries.length === 0, showNames },
      {
        setAutoSort: (autoSort) => setInitiativeConfig({ autoSort }),
        setShowNames: (on) => settings?.setInitiativeNames(on),
        clear: resetInitiative,
      },
    );
    openContextMenuGlobal(entries, { x: rect.left, y: rect.bottom }, { returnFocus: button, doc: button.ownerDocument });
  };

  // Hover handler for statblock preview (Mod+hover): it lives while Mod is held, and a card left without Mod ends it
  const handleEntryHover = useCallback(
    (entry: InitiativeEntry | null, cardElement?: HTMLElement): void => {
      if (!entry) {
        previewActions.closePreview();
        return;
      }
      if (!entry.statblockPath) return;

      // The scene this list was drawn from goes with the preview, whatever loads while it stays open
      const originContext = captureRollContext(view?.viewId, { mapPath, mapLoaded, isMapLoading, objects: { tokens } }, [entry.tokenId]);
      previewActions.showPreview({ entry, originContext }, entry.statblockPath, cardElement);
    },
    [previewActions, view, mapPath, mapLoaded, isMapLoading, tokens]
  );

  // Don't render if closed
  if (!isOpen) return null;

  // `index` is the card's place among all combatants, which is what a drag reorders
  const card = (entry: InitiativeEntry, index: number): React.ReactElement => (
    <InitiativeCard
      key={entry.id}
      entry={entry}
      index={index}
      bySides={bySides}
      byCards={byCards}
      showName={showNames}
      isEditingNumber={numberEditing.editingId === entry.id}
      onStartNumberEdit={numberEditing.start}
      onCommitNumber={numberEditing.commit}
      onCancelNumberEdit={numberEditing.cancel}
      isHoveredForPreview={previewState.hoveredEntry?.entry.id === entry.id}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onContextMenu={handleContextMenu}
      onHover={handleEntryHover}
    />
  );

  return (
    <div className={`atlas-initiative-tracker${showNames ? ' atlas-initiative-tracker--named' : ''}`}>
      {/* Nothing is rolled where the sides take turns or cards are dealt */}
      <InitiativeTrackerControls
        rolls={!bySides && !byCards}
        empty={sortedEntries.length === 0}
        rolling={rolling}
        fightRuns={initiative.isActive}
        onRoll={() => roll()}
        onStart={startCombat}
        onEnd={endCombat}
        onOptions={openOptions}
      />

      {/* Content - Cards for each combatant */}
      <div ref={contentRef} className="atlas-initiative-tracker__content">
        {sortedEntries.length === 0 && (
          <p className="atlas-initiative-tracker__empty">Right-click a token to add it</p>
        )}
        {sortedEntries.length > 0 && (
          <InitiativeTrackerList
            entries={sortedEntries}
            tokens={tokens}
            bySides={bySides}
            sides={sides}
            card={card}
          />
        )}
      </div>

      <InitiativeStatblockPreview app={app} state={previewState} tokens={tokens} />

      <InitiativeTurnControls
        fightRuns={initiative.isActive}
        round={initiative.round}
        onPrevious={() => previousTurn(defeated())}
        onNext={() => nextTurn(defeated())}
      />

      {/* Edit Initiative Popup - positioned like statblock preview */}
      {editPopup}
    </div>
  );
};

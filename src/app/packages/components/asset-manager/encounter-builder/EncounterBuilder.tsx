import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { App } from 'obsidian';
import type { AssetService } from '../../../../services/AssetService';
import { saveEncounter } from '../../../../encounters/encounterSaveService';
import { collectionResources } from '../../../../resources/collectionResources';
import { useCreatureIndex } from '../../../../creatures/useCreatureIndex';
import { linkedStatblockPaths } from '../../../../creatures/creatureFacts';
import { PaneDiceRolls } from '../../../../statblocks/editor/statblock-pane/PaneDiceRolls';
import { isShortcutScopeActive } from '../../../../utils/activeLeafGuard';
import { dialogOverlayMotion, useDialogWindowVariants } from '../../primitives/dialogMotion';
import { ActiveFilterBar } from '../components/search/ActiveFilterBar';
import { t } from '../../../../i18n';
import type { TokenAsset } from '../types';
import { EncounterTray } from './EncounterTray';
import { RosterFeed } from './RosterFeed';
import { EncounterSidebar } from './EncounterSidebar';
import { StatblockFeeds } from '../../../../react/components/dm-screen/StatblockFeeds';
import { StatblockSkeleton } from '../../../../react/components/statblock/StatblockSkeleton';
import { countOf, encounterDrafts, withCount, type EncounterPick } from './encounterPicks';
import { encounterMetrics } from './encounterMetrics';
import { useEncounterRoster } from './useEncounterRoster';

const SKELETONS = ['a', 'b', 'c', 'd'];

interface EncounterBuilderProps {
  app: App;
  assetService: AssetService | null;
  collectionId: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Builds an encounter from a collection's creatures while reading their statblocks: the feeds of
 * the DM screen float over the asset manager, searched and filtered as the Characters tab is, and
 * the tray at the bottom holds what was picked until it is saved as an encounter.
 */
export function EncounterBuilder({ app, assetService, collectionId, onClose, onSaved }: EncounterBuilderProps): React.JSX.Element {
  const roster = useEncounterRoster(app, assetService, collectionId, true);
  const [picks, setPicks] = useState<EncounterPick[]>([]);
  const [saving, setSaving] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const windowVariants = useDialogWindowVariants();

  const resources = useMemo(
    () => (assetService ? collectionResources(assetService.getCollectionSettings(collectionId)) : []),
    [assetService, collectionId],
  );
  const pickedPaths = useMemo(() => linkedStatblockPaths(picks.map((pick) => pick.token)), [picks]);
  const creatures = useCreatureIndex(app, pickedPaths);
  const metrics = useMemo(() => encounterMetrics(picks, creatures.get, resources), [picks, creatures, resources]);

  const changeCount = useCallback((token: TokenAsset, count: number): void => {
    setPicks((current) => withCount(current, token, count));
  }, []);
  const countOfToken = useCallback((tokenId: string): number => countOf(picks, tokenId), [picks]);

  const save = async (): Promise<void> => {
    if (!assetService || picks.length === 0) return;
    setSaving(true);
    try {
      const saved = await saveEncounter(app, assetService, collectionId, encounterDrafts(picks));
      if (!saved) return;
      app.workspace.trigger('atlas-vtt:refresh-assets');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    windowRef.current?.focus();
    const doc = windowRef.current?.ownerDocument;
    if (!doc) return undefined;
    // Bubbling, so the filter panel, the suggestions and open menus take Escape first.
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || !isShortcutScopeActive(windowRef.current)) return;
      if (windowRef.current?.querySelector('[aria-haspopup="menu"][aria-expanded="true"]')) return;
      event.preventDefault();
      onClose();
    };
    doc.addEventListener('keydown', handleKeyDown);
    return () => doc.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const renderFeed = (): React.JSX.Element => {
    if (roster.loading) {
      return (
        <div className="atlas-encounter-builder__feed">
          <StatblockFeeds>
            {SKELETONS.map((key) => <StatblockSkeleton key={key} />)}
          </StatblockFeeds>
        </div>
      );
    }
    if (roster.shown.length === 0) {
      return (
        <p className="atlas-encounter-builder__notice">
          {roster.total === 0 ? t('encounter.builder.noCreatures') : t('encounter.builder.noMatches')}
        </p>
      );
    }
    return (
      <RosterFeed
        app={app}
        creatures={roster.shown}
        refinement={roster.refinement}
        countOf={countOfToken}
        onCountChange={changeCount}
      />
    );
  };

  return (
    <motion.div
      {...dialogOverlayMotion}
      className="atlas-vtt-plugin atlas-vtt-root atlas-encounter-builder"
      // A click beside the builder never throws away creatures already picked.
      onClick={() => { if (picks.length === 0) onClose(); }}
    >
      <motion.div
        ref={windowRef}
        className="atlas-encounter-builder__window"
        variants={windowVariants}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <PaneDiceRolls app={app} collectionId={collectionId} coversMaps>
          <EncounterSidebar
            app={app}
            titleId={titleId}
            search={roster.search}
            onSearch={roster.setSearch}
            query={roster.query}
            onClose={onClose}
          />
          <div className="atlas-encounter-builder__main">
            {/* Its height is kept whether filters are active or not, so applying one never moves the feed. */}
            <div className="atlas-encounter-builder__status">
              <div className="atlas-encounter-builder__status-row">
                {!roster.loading && roster.total > 0 && (
                  <span className="atlas-encounter-builder__total">
                    {roster.shown.length === roster.total
                      ? t('encounter.builder.count', { count: roster.total })
                      : t('encounter.builder.shown', { shown: roster.shown.length, count: roster.total })}
                  </span>
                )}
                <ActiveFilterBar groups={roster.query.chips} onReset={roster.query.reset} />
              </div>
            </div>
            {renderFeed()}
            <AnimatePresence>
              {picks.length > 0 && (
                <EncounterTray
                  picks={picks}
                  metrics={metrics}
                  saving={saving}
                  onCountChange={changeCount}
                  onClear={() => setPicks([])}
                  onSave={() => { void save(); }}
                />
              )}
            </AnimatePresence>
          </div>
        </PaneDiceRolls>
      </motion.div>
    </motion.div>
  );
}

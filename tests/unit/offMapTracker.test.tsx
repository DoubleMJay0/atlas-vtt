// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InitiativeEntry } from '../../src/app/types/initiativeTypes';
import type { ContextMenuEntry } from '../../src/app/react/root/ContextMenuContext';
import type { TokenEntity } from '../../src/app/types';

const state = vi.hoisted(() => ({
  objects: { tokens: {} as Record<string, unknown> },
  tokenSettings: { showInstanceBadges: true },
}));

vi.mock('../../src/app/react/root/AtlasUIContext', async () => ({
  AtlasUIContext: (await import('react')).createContext(null),
  useAtlasUI: () => ({ app: { vault: { adapter: { getResourcePath: (path: string) => `app://${path}` } } }, view: null }),
}));
vi.mock('../../src/app/react/ViewStoreContext', () => ({
  useAtlasStore: (selector: (s: typeof state) => unknown) => selector(state),
  useViewStoreHook: () => ({ getState: () => state }),
}));
vi.mock('../../src/app/resources/useMapResources', () => ({ useMapResources: () => [] }));

import { InitiativeCard } from '../../src/app/react/components/InitiativeCard';
import { initiativeCardMenu } from '../../src/app/react/components/initiativeCardMenu';
import { initiativeTrackerOptions } from '../../src/app/react/components/initiativeTrackerOptions';

const entry: InitiativeEntry = {
  id: 'entry-1', tokenId: 't1', name: 'Goblin', initiative: 12, initiativeModifier: 0,
  imagePath: 'tokens/goblin.webp', isActive: false, isNPC: true, order: 0,
};
const goblin = (extra: Partial<TokenEntity> = {}): TokenEntity => ({ id: 't1', kind: 'character', name: 'Goblin', imagePath: 'tokens/goblin.webp', x: 0, y: 0, ...extra } as TokenEntity);

function renderCard(token: TokenEntity): HTMLElement {
  state.objects.tokens = { t1: token };
  return render(
    <InitiativeCard entry={entry} index={0} isHoveredForPreview={false}
      onDragStart={vi.fn()} onDragOver={vi.fn()} onDragEnd={vi.fn()} onContextMenu={vi.fn()} onHover={vi.fn()} />,
  ).container;
}

const labels = (entries: ContextMenuEntry[]): string[] => entries.flatMap((item) => (item.type === 'item' ? [item.label] : []));
const noop = (): void => undefined;
const actions = { roll: noop, moveToFront: noop, moveToBack: noop, edit: noop, updateToken: noop, setSitsOut: noop, delay: noop, actNow: noop, remove: noop };

describe('a combatant kept beside the map, in the tracker', () => {
  it('carries a "not on the map" marker that a token on the map does not', () => {
    expect(renderCard(goblin({ offMap: true })).querySelector('.atlas-initiative-card__off-map-badge')).not.toBeNull();
    expect(renderCard(goblin()).querySelector('.atlas-initiative-card__off-map-badge')).toBeNull();
  });

  it('is placed on the map from its card\'s menu, which a token on the map does not offer', () => {
    const placeOnMap = vi.fn();
    const beside = initiativeCardMenu(entry, goblin({ offMap: true }), { bySides: false, fightRuns: false }, { ...actions, placeOnMap });
    expect(labels(beside)).toContain('Place on Map');
    const item = beside.find((candidate): candidate is Extract<ContextMenuEntry, { type: 'item' }> => candidate.type === 'item' && candidate.label === 'Place on Map');
    void item?.onClick();
    expect(placeOnMap).toHaveBeenCalledTimes(1);
    expect(labels(initiativeCardMenu(entry, goblin(), { bySides: false, fightRuns: false }, { ...actions, placeOnMap }))).not.toContain('Place on Map');
  });

  it('is added from the tracker\'s options, which open the library\'s tokens', () => {
    const addCombatant = vi.fn();
    const entries = initiativeTrackerOptions({ autoSort: true, bySides: false, empty: true, showNames: false }, { setAutoSort: noop, setShowNames: noop, clear: noop, addCombatant });
    const item = entries.find((candidate): candidate is Extract<ContextMenuEntry, { type: 'item' }> => candidate.type === 'item' && candidate.label === 'Add combatant…');
    void item?.onClick();
    expect(addCombatant).toHaveBeenCalledTimes(1);
  });
});

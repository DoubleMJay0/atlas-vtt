import React, { useLayoutEffect, useRef, useState } from 'react';
import type { App } from 'obsidian';
import { Plus } from 'lucide-react';
import { Button } from '../../primitives/button';
import { LabelTooltip } from '../../primitives/tooltip';
import { LinkedStatblock } from '../../../../statblocks/render/LinkedStatblock';
import { StatblockFeeds } from '../../../../react/components/dm-screen/StatblockFeeds';
import { observeResize } from '../../../../utils/observeResize';
import { t } from '../../../../i18n';
import type { TokenAsset } from '../types';
import { CountStepper } from './CountStepper';

interface RosterFeedProps {
  app: App;
  creatures: readonly TokenAsset[];
  /** Changes whenever the search or a filter does. */
  refinement: string;
  countOf: (tokenId: string) => number;
  onCountChange: (token: TokenAsset, count: number) => void;
}

/** Statblocks drawn at first and added each time the feed nears its end: a collection can hold hundreds, each a full card. */
const PAGE = 12;
/** How far below the visible end the next statblocks are drawn, in pixels. */
const AHEAD = 1200;

/**
 * The collection's creatures as the DM screen shows statblocks: full cards in feeds side by side,
 * as many as the width holds, each with the control that adds it to the encounter.
 */
export function RosterFeed({ app, creatures, refinement, countOf, onCountChange }: RosterFeedProps): React.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(PAGE);
  const shown = creatures.slice(0, limit);
  const more = creatures.length > limit;

  // Another search starts at the top again with the first page.
  useLayoutEffect(() => {
    setLimit(PAGE);
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [refinement]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !more) return undefined;
    const fill = (): void => {
      if (scroller.scrollTop + scroller.clientHeight + AHEAD >= scroller.scrollHeight) setLimit((current) => current + PAGE);
    };
    // The resize observer's first call fills the pane once the drawn statblocks have their heights.
    scroller.addEventListener('scroll', fill, { passive: true });
    const content = scroller.firstElementChild;
    const stopObserving = observeResize(content ? [scroller, content] : [scroller], fill);
    return () => {
      scroller.removeEventListener('scroll', fill);
      stopObserving();
    };
  }, [more, limit]);

  return (
    <div ref={scrollerRef} className="atlas-encounter-builder__feed">
      <StatblockFeeds>
        {shown.map((token) => {
          const count = countOf(token.id);
          return (
            <article key={token.id} className="atlas-encounter-card" data-picked={count > 0}>
              <div className="atlas-encounter-card__actions">
                {count > 0 ? (
                  <CountStepper name={token.name} count={count} onChange={(next) => onCountChange(token, next)} />
                ) : (
                  <LabelTooltip label={t('encounter.builder.addNamed', { name: token.name })} describe>
                    <Button variant="default" className="atlas-encounter-card__add" onClick={() => onCountChange(token, 1)}>
                      <Plus />
                      {t('encounter.builder.add')}
                    </Button>
                  </LabelTooltip>
                )}
              </div>
              {token.statblockPath && <LinkedStatblock app={app} path={token.statblockPath} variant="feed" />}
            </article>
          );
        })}
      </StatblockFeeds>
    </div>
  );
}

import React from 'react';
import { isContainerBlock, type TemplateBlock } from '../../../../statblocks/model/templateTypes';
import type { BlockChrome, BlockDecoration } from '../../../../statblocks/render/blockChrome';
import type { SheetMetric, SheetMetrics } from '../../../../recovery/editor/recoveryMetrics';
import { MetricSpot, RefusedSpot, type SpotProps } from './MetricSpot';

/** What the spots of the card share; each spot adds its own metric. */
export type SpotShared = Omit<SpotProps, 'spotId' | 'label' | 'badge' | 'order' | 'picked' | 'source' | 'tabbable'>;

export interface RecoveryChromeInput {
  metrics: SheetMetrics;
  shared: SpotShared;
  /** The badge of a metric under the selected button's rule, or null. */
  badgeOf: (metric: SheetMetric) => string | null;
  picked: string | null;
  /** Spots offered as what a Spend rule spends. */
  sources: ReadonlySet<string> | null;
  /** The spot the Tab key stops at. */
  tabStop: string | null;
}

/**
 * How the recovery editor dresses the card (the template editor's seam, `BlockChromeContext`): a
 * metric gets a spot laid over it, a number no resource reads a spot that says so, and every other
 * block a class that dims it while a metric is picked. Nothing changes a block's box.
 */
export function recoveryChrome({ metrics, shared, badgeOf, picked, sources, tabStop }: RecoveryChromeInput): BlockChrome {
  const order = new Map(metrics.metrics.map((metric, index) => [metric.blockId, index]));
  return {
    decorate(block: TemplateBlock): BlockDecoration | null {
      const metric = metrics.byBlock.get(block.id);
      if (metric) {
        return {
          className: picked === block.id ? 'atlas-rc-block atlas-rc-block--picked' : 'atlas-rc-block atlas-rc-block--metric',
          overlay: (
            <MetricSpot
              {...shared}
              spotId={block.id}
              label={metric.label}
              badge={badgeOf(metric)}
              order={order.get(block.id) ?? 0}
              picked={picked === block.id}
              source={sources?.has(block.id) ?? false}
              tabbable={tabStop === block.id}
            />
          ),
        };
      }
      if (metrics.refused.has(block.id)) return { className: 'atlas-rc-block', overlay: <RefusedSpot /> };
      return isContainerBlock(block) ? null : { className: 'atlas-rc-block' };
    },
  };
}

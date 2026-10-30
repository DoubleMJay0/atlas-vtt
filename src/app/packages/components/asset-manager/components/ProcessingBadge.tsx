import React from 'react';
import type { AnyAsset } from '../types';
import { LabelTooltip } from '../../primitives/tooltip';
import { ProcessingRing } from '../../primitives/ProcessingRing';
import { useAssetProcessing } from '../hooks/useAssetProcessing';
import { t } from '../../../../i18n';

/**
 * "Processing" on the artwork of a map or scene whose map image is still being cut into tiles:
 * the map opens and works meanwhile, only softer until its tiles land. Gone once they have.
 */
export function ProcessingBadge({ asset }: { asset: AnyAsset }): React.JSX.Element | null {
  const percent = useAssetProcessing(asset);
  if (percent === null) return null;
  return (
    <LabelTooltip label={t('am.card.processingProgress', { percent })} describe>
      <div className="atlas-asset-processing">
        <ProcessingRing percent={percent} />
        <span className="atlas-asset-processing__label">{t('am.card.processing')}</span>
      </div>
    </LabelTooltip>
  );
}

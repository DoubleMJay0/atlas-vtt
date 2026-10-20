import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { HiddenSummary, OptionsFacet, RangeFacet } from '../../../../../creatures/creatureFilterEngine';
import { hasPicks, LAYOUT_FACET, withOptionState, withRange, withStatblockFilter } from '../../../../../creatures/creatureSelection';
import type { StatblockLinkFilter } from '../../../../../types/creatureFilterTypes';
import { EASE_OUT_CONTROL_POINTS } from '../../../../../utils/motion';
import { Button } from '../../../primitives/button';
import { CloseButton } from '../../../primitives/CloseButton';
import { SegmentedControl } from '../../../primitives/SegmentedControl';
import { Skeleton, SkeletonGroup } from '../../../primitives/Skeleton';
import { useDialogEscape } from '../../../primitives/useDialogEscape';
import type { CreatureFilterPanel } from '../../hooks/useCreatureFilters';
import { FilterSection } from './FilterSection';
import { OptionChips } from './OptionChips';
import { RangeFilter } from './RangeFilter';
import { t } from '../../../../../i18n';

const STATBLOCK_CHOICES = [
  { value: 'any', label: t('filters.all') },
  { value: 'linked', label: t('filters.withStatblock') },
  { value: 'unlinked', label: t('filters.without') },
] as const;

/** The statblock template's filters show this many before the rest fold away. */
const TEMPLATE_FOLD_AT = 3;

function isFacetActive(facet: RangeFacet | OptionsFacet): boolean {
  return 'values' in facet ? facet.selected !== null : facet.options.some((option) => option.state !== null);
}

const PANEL_MOTION = {
  initial: { opacity: 0, transform: 'translateY(-4px) scale(0.98)' },
  animate: { opacity: 1, transform: 'translateY(0px) scale(1)' },
  exit: { opacity: 0, transform: 'translateY(-4px) scale(0.98)' },
  transition: { duration: 0.16, ease: EASE_OUT_CONTROL_POINTS },
};

function hiddenText({ withoutStatblock, withoutField }: HiddenSummary): string | null {
  const parts = [
    ...(withoutStatblock > 0 ? [t('filters.hiddenNoStatblock', { count: withoutStatblock })] : []),
    ...withoutField.map(({ label, count }) => t('filters.hiddenNoField', { count, field: label.toLocaleLowerCase() })),
  ];
  return parts.length > 0 ? t('filters.hidden', { parts: parts.join(', ') }) : null;
}

/** The two placeholder filters: the widths of their title and of their chips, in px. */
const SKELETON_FILTERS = [
  { title: 96, chips: [64, 88, 52, 76, 60] },
  { title: 56, chips: [72, 48, 84] },
] as const;

/** Stands in for the filters while the statblocks they come from are read. */
function FilterSkeleton(): React.JSX.Element {
  return (
    <SkeletonGroup label="Reading statblocks…" className="atlas-filter-skeleton">
      {SKELETON_FILTERS.map((filter) => (
        <div key={filter.title} className="atlas-filter-section">
          <div className="atlas-filter-section__header"><Skeleton shape="text" width={filter.title} /></div>
          <div className="atlas-filter-chips">
            {filter.chips.map((width) => <Skeleton key={width} shape="pill" className="atlas-filter-chip-skeleton" width={width} />)}
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}

interface AdvancedFilterPanelProps {
  panel: CreatureFilterPanel;
  onClose: () => void;
  onReset: () => void;
  /** The button that opens the panel; a click on it is not a click outside. */
  anchorRef: React.RefObject<HTMLElement | null>;
}

/**
 * The filters of the Characters tab under the search: the statblock fields the
 * characters in view have, as ranges and option chips. The search's typed
 * filters and the chips under the header edit the same selection.
 */
export function AdvancedFilterPanel({ panel, onClose, onReset, anchorRef }: AdvancedFilterPanelProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const { selection, setSelection, result } = panel;
  const { facets } = result;
  const hidden = hiddenText(result.hidden);
  const ranges = facets.ranges.filter((facet) => facet.values.length > 1 || facet.selected);
  const options = facets.options.filter((facet) => facet.options.length > 0);
  const showLayouts = facets.layouts.length > 1 || hasPicks(selection.layouts);
  const fromTemplate = (facet: RangeFacet | OptionsFacet): boolean => facet.definition.origin === 'template';
  const templateFacets = [...ranges.filter(fromTemplate), ...options.filter(fromTemplate)];
  const hasStatblockFields = ranges.length > 0 || options.length > 0 || showLayouts;
  const [templateExpanded, setTemplateExpanded] = useState(false);
  // Folded to its first few while it holds many; never while one of the folded ones filters.
  const foldsTemplate = templateFacets.length > TEMPLATE_FOLD_AT
    && !templateFacets.slice(TEMPLATE_FOLD_AT).some((facet) => isFacetActive(facet));
  const shownTemplateFacets = foldsTemplate && !templateExpanded ? templateFacets.slice(0, TEMPLATE_FOLD_AT) : templateFacets;

  const renderFacet = (facet: RangeFacet | OptionsFacet): React.JSX.Element => ('values' in facet ? (
    <RangeFilter
      key={facet.definition.id}
      facet={facet}
      onChange={(range) => setSelection((current) => withRange(current, facet.definition.id, range))}
    />
  ) : (
    <FilterSection key={facet.definition.id} title={facet.definition.label} active={isFacetActive(facet)}>
      <OptionChips
        label={facet.definition.label}
        options={facet.options}
        onChange={(key, state) => setSelection((current) => withOptionState(current, facet.definition.id, key, state))}
      />
    </FilterSection>
  ));

  useDialogEscape(rootRef, onClose);

  useEffect(() => {
    const doc = rootRef.current?.ownerDocument ?? document;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !anchorRef.current?.contains(target)) onClose();
    };
    doc.addEventListener('pointerdown', onPointerDown);
    return () => doc.removeEventListener('pointerdown', onPointerDown);
  }, [onClose, anchorRef]);

  return (
    <motion.div ref={rootRef} className="atlas-filter-panel" role="dialog" aria-label={t('filters.title')} {...PANEL_MOTION}>
      <div className="atlas-filter-panel__header">
        <h3>{t('filters.title')}</h3>
        <CloseButton onClick={onClose} aria-label={t('filters.close')} />
      </div>

      <div className="atlas-filter-panel__body">
        <p className="atlas-filter-panel__hint">{t('filters.hint')}</p>
        <FilterSection title={t('filters.statblock')} active={selection.statblock !== 'any'}>
          <SegmentedControl
            className="atlas-filter-panel__statblock"
            ariaLabel={t('filters.statblock')}
            value={selection.statblock}
            options={STATBLOCK_CHOICES}
            onChange={(value: StatblockLinkFilter) => setSelection((current) => withStatblockFilter(current, value))}
          />
        </FilterSection>

        {ranges.filter((facet) => !fromTemplate(facet)).map(renderFacet)}
        {options.filter((facet) => !fromTemplate(facet)).map(renderFacet)}

        {showLayouts && (
          <FilterSection title={t('filters.template')} active={hasPicks(selection.layouts)}>
            <OptionChips
              label={t('filters.template')}
              options={facets.layouts}
              onChange={(layout, state) => setSelection((current) => withOptionState(current, LAYOUT_FACET, layout, state))}
            />
          </FilterSection>
        )}

        {templateFacets.length > 0 && (
          <div className="atlas-filter-panel__group" role="group" aria-label={t('filters.templateFields')}>
            <div className="atlas-filter-panel__group-label">{t('filters.templateFields')}</div>
            {shownTemplateFacets.map(renderFacet)}
            {foldsTemplate && (
              <Button variant="ghost" className="atlas-filter-chips__more" onClick={() => setTemplateExpanded(!templateExpanded)}>
                {templateExpanded ? t('filters.showFewer') : t('filters.showAll', { count: templateFacets.length })}
              </Button>
            )}
          </div>
        )}

        {!hasStatblockFields && (panel.pending ? <FilterSkeleton /> : (
          <p className="atlas-filter-panel__empty">
            {t('filters.linkHint')}
          </p>
        ))}
      </div>

      <div className="atlas-filter-panel__footer">
        {hidden && <span className="atlas-filter-panel__hidden" role="status">{hidden}</span>}
        <Button variant="ghost" className="atlas-filter-panel__reset" disabled={panel.activeCount === 0} onClick={onReset}>{t('common.reset')}</Button>
        <Button variant="default" className="atlas-filter-panel__done" onClick={onClose}>{t('common.done')}</Button>
      </div>
    </motion.div>
  );
}

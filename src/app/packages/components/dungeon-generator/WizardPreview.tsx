import React, { useRef } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { Dices } from 'lucide-react';
import { Button } from '../primitives/button';
import { LabelTooltip } from '../primitives/tooltip';
import { EASE_OUT_CONTROL_POINTS as EASE_OUT, MOTION_EASE_OUT, PANEL_ENTER_MS, PANEL_EXIT_MS } from '../../../utils/motion';
import { t } from '../../../i18n';
import { ExportButton } from './ExportButton';
import { FloorSwitcher } from './FloorSwitcher';
import { MapPreview } from './MapPreview';
import type { DungeonState } from './useDungeonState';
import type { GeneratorActions } from './useGeneratorActions';
import type { MapPreview as Preview } from './useMapPreview';
import type { Box } from './wizardLayout';

interface WizardPreviewProps {
  box: Box;
  /** The preview slides out from the panel: -1 when it stands to the panel's left, 1 otherwise. */
  side: -1 | 1;
  preview: Preview;
  state: DungeonState;
  actions: GeneratorActions;
  onFrame: (frame: HTMLDivElement | null) => void;
}

/** Slides out from behind the panel a beat after it, as if the panel unfolded it. */
function previewVariants(side: -1 | 1, reduced: boolean): Variants {
  const from = reduced ? 'none' : `translateX(${-16 * side}px) scale(0.98)`;
  return {
    hidden: { opacity: 0, transform: from },
    visible: { opacity: 1, transform: 'translateX(0px) scale(1)', transition: { duration: PANEL_ENTER_MS / 1000, ease: EASE_OUT, delay: reduced ? 0 : 0.06 } },
    exit: { opacity: 0, transform: from, transition: { duration: PANEL_EXIT_MS / 1000, ease: EASE_OUT } },
  };
}

/** One turn of the dice, whatever the drawing then takes. */
function roll(icon: SVGSVGElement | null): void {
  if (!icon || typeof icon.animate !== 'function') return;
  if (icon.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  icon.animate([{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(200deg) scale(0.85)' }, { transform: 'rotate(360deg) scale(1)' }], { duration: 520, easing: MOTION_EASE_OUT });
}

/**
 * The live map of the dungeon the wizard makes, floating beside the panel: New layout and Export
 * on its top right, the floor switcher at its foot for a dungeon of several floors.
 */
export function WizardPreview({ box, side, preview, state, actions, onFrame }: WizardPreviewProps): React.JSX.Element {
  const reduced = useReducedMotion() ?? false;
  const dice = useRef<SVGSVGElement>(null);
  return (
    <motion.div
      className="atlas-dungeon-wizard-preview"
      style={box}
      variants={previewVariants(side, reduced)}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <MapPreview
        preview={preview}
        view={state.settings.view}
        onFrame={onFrame}
        onHideWing={state.hideWing}
        onShowHiddenWings={state.edits.hiddenWings?.length ? state.showHiddenWings : undefined}
      />
      <div className="atlas-dungeon-wizard-preview__tools">
        <ExportButton actions={actions} ready={state.model !== null} className="atlas-dungeon-wizard-preview__tool" />
        <LabelTooltip label={t('dungeon.new')}>
          <Button
            variant="ghost"
            size="icon"
            className="atlas-dungeon-wizard-preview__tool"
            disabled={actions.creating}
            onClick={() => {
              roll(dice.current);
              state.newSeed();
            }}
          >
            <Dices ref={dice} />
          </Button>
        </LabelTooltip>
      </div>
      <FloorSwitcher floors={state.floors} floor={state.floor} onFloor={state.setFloor} model={state.model} />
    </motion.div>
  );
}

import React, { useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight, Loader2, Map as MapIcon } from 'lucide-react';
import type { DungeonStyleId } from '../../../dungeons/styleCatalog';
import { observeResize } from '../../../utils/observeResize';
import { EASE_OUT_CONTROL_POINTS as EASE_OUT } from '../../../utils/motion';
import { t } from '../../../i18n';
import { cn } from '../../../../utils/cn';
import { Button } from '../primitives/button';
import { CloseButton } from '../primitives/CloseButton';
import { LabelTooltip } from '../primitives/tooltip';
import type { DungeonState } from './useDungeonState';
import type { GeneratorActions } from './useGeneratorActions';
import { WizardStepContent } from './WizardStepContent';
import { stepName, stepTitle, WIZARD_STEPS } from './wizardSteps';

interface WizardPanelProps {
  /** The step shown, by index into `WIZARD_STEPS`. */
  step: number;
  /** 1 when the step came after the one before, -1 when it came back. */
  direction: 1 | -1;
  onStep: (step: number) => void;
  titleId: string;
  state: DungeonState;
  actions: GeneratorActions;
  thumbnails: ReadonlyMap<DungeonStyleId, ImageBitmap>;
  onArt: (art: HTMLSpanElement | null) => void;
  onClose: () => void;
}

const SLIDE_PX = 24;
const STEP_S = 0.22;

/** A step comes in from the side it lies on and the one left goes out the other way. */
const stepVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, transform: `translateX(${direction * SLIDE_PX}px)` }),
  center: { opacity: 1, transform: 'translateX(0px)', transition: { duration: STEP_S, ease: EASE_OUT } },
  exit: (direction: number) => ({ opacity: 0, transform: `translateX(${-direction * SLIDE_PX}px)`, transition: { duration: STEP_S * 0.7, ease: EASE_OUT } }),
};

const fadingStepVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: STEP_S } },
  exit: { opacity: 0, transition: { duration: STEP_S * 0.7 } },
};

/** The height of the step shown, which the body grows or shrinks to while the steps cross. */
function useStepHeight(): [(node: HTMLElement | null) => void, number | null] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!node) return undefined;
    const measure = (): void => setHeight(node.offsetHeight);
    measure();
    return observeResize([node], measure);
  }, [node]);
  // The step leaving lets go of its node after the next one took it: only a new node counts.
  return [(next) => { if (next) setNode(next); }, height];
}

/**
 * The wizard's panel: where it is (the steps as marks, each a way back to it), the step's
 * question and its controls, Back and Next, and Create scene at the end.
 */
export function WizardPanel({ step, direction, onStep, titleId, state, actions, thumbnails, onArt, onClose }: WizardPanelProps): React.JSX.Element {
  const reduced = useReducedMotion() ?? false;
  const shown = WIZARD_STEPS[step]!;
  const last = step === WIZARD_STEPS.length - 1;
  const named = state.name.trim() !== '';
  const [stepRef, stepHeight] = useStepHeight();
  const create = (): void => { void actions.create(); };

  return (
    <>
      <div className="atlas-dungeon-wizard__header">
        <ol className="atlas-dungeon-wizard__progress" aria-label={t('dungeon.steps')}>
          {WIZARD_STEPS.map((id, index) => (
            <li key={id}>
              <LabelTooltip label={stepName(id)}>
                <button
                  type="button"
                  className={cn('atlas-dungeon-wizard__mark', index < step && 'is-done', index === step && 'is-current')}
                  aria-current={index === step ? 'step' : undefined}
                  aria-label={stepName(id)}
                  onClick={() => onStep(index)}
                />
              </LabelTooltip>
            </li>
          ))}
        </ol>
        <span className="atlas-dungeon-wizard__count" aria-live="polite">
          {t('dungeon.step.of', { current: step + 1, count: WIZARD_STEPS.length })}
        </span>
        <CloseButton onClick={onClose} />
      </div>
      <div className="atlas-dungeon-wizard__body" style={stepHeight === null ? undefined : { height: stepHeight }}>
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.div
            key={shown}
            ref={stepRef}
            className="atlas-dungeon-wizard__step"
            custom={direction}
            variants={reduced ? fadingStepVariants : stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <h2 id={titleId} className="atlas-dungeon-wizard__title">{stepTitle(shown)}</h2>
            <WizardStepContent step={shown} state={state} thumbnails={thumbnails} onArt={onArt} onSubmit={create} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="atlas-dungeon-wizard__footer">
        {actions.problem && !actions.creating && <p className="atlas-dungeon-wizard__problem" role="alert">{actions.problem}</p>}
        <div className="atlas-dungeon-wizard__nav">
          <Button variant="ghost" size="sm" className={cn(step === 0 && 'atlas-dungeon-wizard__back--hidden')} disabled={step === 0} onClick={() => onStep(step - 1)}>
            {t('dungeon.back')}
          </Button>
          {last ? (
            <Button variant="default" size="sm" disabled={actions.creating || !named} onClick={create}>
              {actions.creating ? <Loader2 className="atlas-spin" /> : <MapIcon />}
              <span>{actions.creating ? t('dungeon.creating') : t('dungeon.create')}</span>
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={() => onStep(step + 1)}>
              <span>{t('dungeon.next')}</span>
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

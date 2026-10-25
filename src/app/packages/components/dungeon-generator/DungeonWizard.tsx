import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { App } from 'obsidian';
import { dungeonStyle } from '../../../dungeons/styleCatalog';
import { DungeonWorkerClient } from '../../../dungeons/worker/DungeonWorkerClient';
import { useElementHeight } from '../../../react/hooks/useElementHeight';
import { ContextMenuProvider } from '../../../react/root/ContextMenuContext';
import { observeResize } from '../../../utils/observeResize';
import { useAnchoredPopoverVariants } from '../primitives/dialogMotion';
import { usePreviewSize } from './PreviewCanvas';
import { useThumbnailSize } from './StyleGallery';
import { useDungeonState } from './useDungeonState';
import { useGeneratorActions, type CreatedDungeonScene } from './useGeneratorActions';
import { useMapPreview } from './useMapPreview';
import { useStyleThumbnails } from './useStyleThumbnails';
import { WizardPanel } from './WizardPanel';
import { WizardPreview } from './WizardPreview';
import { wizardLayout, type Box } from './wizardLayout';

/** The panel's width; the pin dropdown it takes over is about as wide. */
export const WIZARD_PANEL_WIDTH = 360;

export interface DungeonWizardProps {
  app: App;
  /** What the wizard stands in: the Atlas view's box, whose size and place it measures. */
  layer: HTMLElement;
  collectionId: string;
  /** The name typed where the wizard was opened from: the scene's name to begin with. */
  initialName?: string | undefined;
  /** The note pin dropdown the wizard takes over, in the window's pixels; unset centres it. */
  anchor?: Box | undefined;
  onCreated: (scene: CreatedDungeonScene) => void;
  /** A scene is being created: whoever holds the wizard waits for it before letting go. */
  onBusyChange?: ((busy: boolean) => void) | undefined;
  onClose: () => void;
}

/** The layer's size, and its corner in the window. */
function useLayerBox(layer: HTMLElement): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const measure = (): void => {
      const { left, top, width, height } = layer.getBoundingClientRect();
      setBox((old) => (old && old.left === left && old.top === top && old.width === width && old.height === height ? old : { left, top, width, height }));
    };
    measure();
    return observeResize([layer], measure);
  }, [layer]);
  return box;
}

/**
 * The dungeon generator as a wizard: a compact panel that asks one thing a step (theme, layout,
 * features, style, name) and the live map floating beside it in a card of its own, which every
 * answer redraws at once. Opened from a note pin it stands where the pin's dropdown stood.
 */
export function DungeonWizard(props: DungeonWizardProps): React.JSX.Element {
  return (
    <ContextMenuProvider local>
      <Wizard {...props} />
    </ContextMenuProvider>
  );
}

function Wizard({ app, layer, collectionId, initialName, anchor, onCreated, onBusyChange, onClose }: DungeonWizardProps): React.JSX.Element {
  const client = useMemo(() => DungeonWorkerClient.forApp(app), [app]);
  const state = useDungeonState(app, initialName);
  const [{ step, direction }, setPosition] = useState<{ step: number; direction: 1 | -1 }>({ step: 0, direction: 1 });
  const goTo = (next: number): void => setPosition((now) => ({ step: next, direction: next >= now.step ? 1 : -1 }));
  const [panelRef, panelHeight] = useElementHeight<HTMLDivElement>();
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [art, setArt] = useState<HTMLSpanElement | null>(null);
  const titleId = useId();
  const view = useLayerBox(layer);
  const { settings } = state;

  const preview = useMapPreview(client, {
    request: state.request,
    generated: state.generated,
    model: state.model,
    style: dungeonStyle(settings.style),
    view: settings.view,
    floor: state.floor,
    size: usePreviewSize(frame),
  }, state.setGenerated);
  // Drawn once the Style step was first shown, and kept up to date from then on, so going back to it finds them.
  const thumbnails = useStyleThumbnails(client, { request: state.request, model: state.model, view: settings.view, size: useThumbnailSize(art), first: settings.style });
  const actions = useGeneratorActions({ app, client, state, collectionId, onCreated, onBusyChange });

  // Opens on the chosen theme, so the arrows run through the themes at once.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || panelHeight === null) return;
    opened.current = true;
    panelRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus({ preventScroll: true });
  }, [panelHeight, panelRef]);

  const local = view && anchor ? { ...anchor, left: anchor.left - view.left, top: anchor.top - view.top } : null;
  const layout = view && panelHeight !== null ? wizardLayout(view, { width: WIZARD_PANEL_WIDTH, height: panelHeight }, local) : null;
  const panelBox = layout?.panel ?? { left: 0, top: 0 };
  // The panel grows out of the dropdown it replaces, or out of its own middle.
  const origin = local && layout
    ? `${local.left + local.width / 2 - layout.panel.left}px ${local.top + local.height / 2 - layout.panel.top}px`
    : 'center';
  const panelVariants = useAnchoredPopoverVariants();

  return (
    <>
      <motion.div
        ref={panelRef}
        className="atlas-dungeon-wizard"
        role="group"
        aria-labelledby={titleId}
        style={{ ...panelBox, width: WIZARD_PANEL_WIDTH, transformOrigin: origin, visibility: layout ? 'visible' : 'hidden' }}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        inert={actions.creating}
      >
        <WizardPanel
          step={step}
          direction={direction}
          onStep={goTo}
          titleId={titleId}
          state={state}
          actions={actions}
          thumbnails={thumbnails}
          onArt={setArt}
          onClose={onClose}
        />
      </motion.div>
      <AnimatePresence>
        {layout && (
          <WizardPreview
            key="preview"
            box={layout.preview}
            side={layout.preview.left < layout.panel.left ? -1 : 1}
            preview={preview}
            state={state}
            actions={actions}
            onFrame={setFrame}
          />
        )}
      </AnimatePresence>
    </>
  );
}

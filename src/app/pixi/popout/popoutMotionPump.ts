import { frameData, frameSteps, type FrameData, type StepId, type Steps } from 'motion-dom';

/** Motion's own order of a frame's steps (`stepsOrder` in motion-dom). */
const STEP_ORDER: readonly StepId[] = ['read', 'resolveKeyframes', 'update', 'preRender', 'render', 'postRender'];
/** The longest frame Motion counts, as its own loop does: a long wait is no leap. */
const MAX_DELTA_MS = 40;

/**
 * Runs Motion's frames (framer-motion) with the frames of `win` while the main window is hidden.
 * Motion asks the main window for its frames, and a main window that a maximised popout covers
 * gets none: in the popout, panels opened invisible and closed ones stayed, over the map.
 *
 * @returns Stops the pump.
 */
export function pumpMotion(win: Window): () => void {
  let previous = performance.now();
  let frame = 0;
  const step = (): void => {
    frame = win.requestAnimationFrame(step);
    const now = performance.now();
    if (window.document.visibilityState === 'hidden') stepStalledMotion(frameSteps, frameData, previous, now);
    previous = now;
  };
  frame = win.requestAnimationFrame(step);
  return (): void => win.cancelAnimationFrame(frame);
}

/**
 * Runs one Motion frame at `now` unless Motion ran one itself since `previous`, the pump's last
 * frame, or is running one: several popouts pump the same loop, which runs once a frame. Times
 * are the main window's `performance.now()`, Motion's clock.
 */
export function stepStalledMotion(steps: Steps, data: FrameData, previous: number, now: number): void {
  if (data.isProcessing || data.timestamp > previous) return;
  data.delta = Math.max(Math.min(now - data.timestamp, MAX_DELTA_MS), 1);
  data.timestamp = now;
  data.isProcessing = true;
  try {
    for (const id of STEP_ORDER) steps[id].process(data);
  } finally {
    data.isProcessing = false;
  }
}

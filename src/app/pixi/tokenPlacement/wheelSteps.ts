/** A wheel event's delta past which it is one notch of a mouse wheel, not a trackpad's glide. */
const NOTCH = 50;
/** How far a trackpad scrolls for one step. */
const GLIDE_STEP = 40;

/**
 * Turns wheel events into whole steps: one per notch of a mouse wheel, one per stretch of a
 * trackpad's scroll, which comes as many small deltas. A mouse wheel turned with Shift held scrolls
 * sideways on macOS, so the larger of the two axes counts; down and right step forward.
 */
export class WheelSteps {
  private rest = 0;

  take(event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>): number {
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (delta === 0) return 0;
    if (event.deltaMode !== 0 || Math.abs(delta) >= NOTCH) {
      this.rest = 0;
      return Math.sign(delta);
    }
    // A change of direction starts the glide over
    if (Math.sign(this.rest) !== Math.sign(delta)) this.rest = 0;
    this.rest += delta;
    const steps = Math.trunc(this.rest / GLIDE_STEP);
    if (steps === 0) return 0;
    this.rest -= steps * GLIDE_STEP;
    return steps;
  }
}

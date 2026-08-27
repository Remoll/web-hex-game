/**
 * One renderer-neutral keyframe for a unit movement presentation.
 * The queue does not know about game rules, meshes, or Three.js.
 */
export interface UnitMovementAnimationState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A complete visual path, whose first state is the movement origin. */
export interface UnitMovementAnimation {
  readonly unitId: string;
  readonly states: readonly UnitMovementAnimationState[];
}

export type UnitMovementFrameHandler = (
  unitId: string,
  from: UnitMovementAnimationState,
  to: UnitMovementAnimationState,
  progress: number,
) => void;

/**
 * Plays whole unit paths in FIFO event order. It deliberately owns no render
 * resources, allowing animation to remain a presentation-only concern.
 */
export class UnitMovementAnimationQueue {
  private readonly pendingAnimations: UnitMovementAnimation[] = [];
  private readonly completedUnitIds: string[] = [];
  private activeAnimation: UnitMovementAnimation | undefined;
  private activeAnimationStartedAtMs: number | undefined;

  constructor(
    private readonly stepDurationMs: number,
    private readonly isEnabled: boolean,
  ) {
    if (!Number.isFinite(stepDurationMs) || stepDurationMs <= 0) {
      throw new Error("Unit movement step duration must be a positive number");
    }
  }

  get isAnimating(): boolean {
    return this.activeAnimation !== undefined || this.pendingAnimations.length > 0;
  }

  enqueue(animations: readonly UnitMovementAnimation[]): void {
    if (!this.isEnabled) {
      return;
    }

    for (const animation of animations) {
      if (animation.states.length >= 2) {
        this.pendingAnimations.push(animation);
      }
    }
  }

  hasAnimationForUnit(unitId: string): boolean {
    return this.activeAnimation?.unitId === unitId
      || this.pendingAnimations.some((animation) => animation.unitId === unitId);
  }

  /**
   * Applies the current interpolated state. Returns completed unit ids so the
   * presentation adapter can synchronize their authoritative final states.
   */
  update(
    nowMs: number,
    applyFrame: UnitMovementFrameHandler,
  ): readonly string[] {
    this.completedUnitIds.length = 0;
    if (!this.isEnabled || !Number.isFinite(nowMs)) {
      return this.completedUnitIds;
    }

    while (true) {
      if (!this.activeAnimation) {
        this.activeAnimation = this.pendingAnimations.shift();
        if (!this.activeAnimation) {
          this.activeAnimationStartedAtMs = undefined;
          break;
        }
        this.activeAnimationStartedAtMs ??= nowMs;
      }

      const activeAnimation = this.activeAnimation;
      const startedAtMs = this.activeAnimationStartedAtMs;
      if (startedAtMs === undefined) {
        break;
      }

      const stepCount = activeAnimation.states.length - 1;
      const totalDurationMs = stepCount * this.stepDurationMs;
      const elapsedMs = Math.max(0, nowMs - startedAtMs);
      if (elapsedMs >= totalDurationMs) {
        const finalState = activeAnimation.states[stepCount];
        applyFrame(activeAnimation.unitId, finalState, finalState, 1);
        this.completedUnitIds.push(activeAnimation.unitId);
        this.activeAnimation = undefined;
        this.activeAnimationStartedAtMs = startedAtMs + totalDurationMs;
        continue;
      }

      const completedStepCount = Math.floor(elapsedMs / this.stepDurationMs);
      const stepElapsedMs = elapsedMs - completedStepCount * this.stepDurationMs;
      applyFrame(
        activeAnimation.unitId,
        activeAnimation.states[completedStepCount],
        activeAnimation.states[completedStepCount + 1],
        stepElapsedMs / this.stepDurationMs,
      );
      break;
    }

    return this.completedUnitIds;
  }

  clear(): void {
    this.pendingAnimations.length = 0;
    this.activeAnimation = undefined;
    this.activeAnimationStartedAtMs = undefined;
  }
}

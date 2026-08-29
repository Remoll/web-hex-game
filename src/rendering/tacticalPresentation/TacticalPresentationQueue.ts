import {
  TacticalPresentationEventKind,
  type TacticalPresentationEvent,
  type UnitMovementEvent,
} from "@/game/gameSession/GameSession";
import {
  UnitMovementAnimationQueue,
  type UnitMovementAnimation,
  type UnitMovementFrameHandler,
  type UnitMovementAnimationState,
} from "@/rendering/unitMotion/UnitMovementAnimationQueue";

export interface TacticalPresentationQueueOptions {
  readonly movementAnimationQueue: UnitMovementAnimationQueue;
  readonly createMovementAnimation: (
    event: UnitMovementEvent,
  ) => UnitMovementAnimation | undefined;
  readonly onEventCompleted: (event: TacticalPresentationEvent) => void;
  readonly onMovementFrame: (
    event: UnitMovementEvent,
    from: UnitMovementAnimationState,
    to: UnitMovementAnimationState,
    progress: number,
  ) => void;
}

/**
 * Replays resolved tactical presentation events one at a time. It never reads
 * mutable game state, so an attack snapshot cannot appear before its earlier
 * movement event finishes.
 */
export class TacticalPresentationQueue {
  private readonly pendingEvents: TacticalPresentationEvent[] = [];
  private activeMovementEvent: UnitMovementEvent | undefined;
  private readonly applyMovementFrame: UnitMovementFrameHandler = (
    unitId,
    from,
    to,
    progress,
  ) => {
    const event = this.activeMovementEvent;
    if (!event || event.unit.id !== unitId) {
      return;
    }

    this.options.onMovementFrame(event, from, to, progress);
  };

  constructor(private readonly options: TacticalPresentationQueueOptions) {}

  /** True while an event is queued or a movement interpolation is in progress. */
  get isAnimating(): boolean {
    return this.activeMovementEvent !== undefined
      || this.pendingEvents.length > 0
      || this.options.movementAnimationQueue.isAnimating;
  }

  enqueue(events: readonly TacticalPresentationEvent[]): void {
    this.pendingEvents.push(...events);
    this.startNextEvents();
  }

  update(currentTimestampInMilliseconds: number): void {
    const completedUnitIds = this.options.movementAnimationQueue.update(
      currentTimestampInMilliseconds,
      this.applyMovementFrame,
    );

    if (completedUnitIds.length === 0) {
      return;
    }

    const completedEvent = this.activeMovementEvent;
    if (!completedEvent) {
      return;
    }

    this.activeMovementEvent = undefined;
    this.options.onEventCompleted(completedEvent);
    this.startNextEvents();
  }

  hasAnimationForUnit(unitId: string): boolean {
    return this.options.movementAnimationQueue.hasAnimationForUnit(unitId);
  }

  clear(): void {
    this.pendingEvents.length = 0;
    this.activeMovementEvent = undefined;
    this.options.movementAnimationQueue.clear();
  }

  private startNextEvents(): void {
    while (!this.activeMovementEvent && this.pendingEvents.length > 0) {
      const event = this.pendingEvents.shift();
      if (!event) {
        return;
      }

      if (event.kind === TacticalPresentationEventKind.Attack) {
        this.options.onEventCompleted(event);
        continue;
      }

      const animation = this.options.createMovementAnimation(event);
      if (!animation) {
        this.options.onEventCompleted(event);
        continue;
      }

      this.activeMovementEvent = event;
      this.options.movementAnimationQueue.enqueue([animation]);
      if (this.options.movementAnimationQueue.isAnimating) {
        return;
      }

      this.activeMovementEvent = undefined;
      this.options.onEventCompleted(event);
    }
  }
}

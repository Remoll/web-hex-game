import { baseTacticalTempo } from "@/game/unit/tacticalAttributes/TacticalAttributes";

/**
 * The only information the timeline needs from a scheduled unit. Keeping this
 * structural prevents the scheduler from owning combat, movement, or AI rules.
 */
export interface TimelineParticipant {
  readonly id: string;
  readonly isAlive: boolean;
  readonly tempo: number;
}

/** Stable action names used by the domain and the minimal timeline HUD. */
export enum TimelineAction {
  Move = "move",
  Attack = "attack",
  Command = "command",
  Wait = "wait",
}

/** Integer timeline costs. These are simulation time, never wall-clock time. */
export const timelineActionCosts: Readonly<Record<TimelineAction, number>> = {
  [TimelineAction.Move]: 100,
  [TimelineAction.Attack]: 140,
  [TimelineAction.Command]: 100,
  [TimelineAction.Wait]: 100,
};

export const minimumTimelineRecoveryDelay = 1;

/** Converts a unit's tempo into integer simulation time for one action. */
export function getTimelineRecoveryDelay(
  action: TimelineAction,
  tempo: number,
): number {
  if (!Number.isInteger(tempo) || tempo <= 0) {
    throw new Error("Timeline tempo must be a positive integer");
  }

  return Math.max(
    minimumTimelineRecoveryDelay,
    Math.round(timelineActionCosts[action] * baseTacticalTempo / tempo),
  );
}

export interface TimelineActor {
  readonly unitId: string;
  readonly nextReadyAt: number;
}

export interface TimelinePresentation {
  readonly currentTime: number;
  readonly readyActorId: string | undefined;
  readonly actionCosts: Readonly<Record<TimelineAction, number>>;
}

export interface EventTimelineReader {
  readonly currentTime: number;
  readonly readyActor: TimelineActor | undefined;
  readonly presentation: TimelinePresentation;
  getNextReadyAt(unitId: string): number | undefined;
  isReady(unitId: string): boolean;
}

/** Resolves exactly one autonomous action for a non-Mage timeline entry. */
export type ResolveAutonomousTimelineAction = (
  participant: TimelineParticipant,
) => TimelineAction;

interface TimelineEntry {
  readonly participant: TimelineParticipant;
  readonly registrationOrder: number;
  nextReadyAt: number;
}

const initialReadyAt = 0;

/**
 * A deterministic discrete-event scheduler. Actors are ordered by the lowest
 * `nextReadyAt`, then by their initial registration order. Rescheduling an
 * actor replaces its sole entry, so a previously scheduled event cannot fire
 * later as stale work. Defeated actors are pruned before every public query or
 * transition.
 */
export class EventTimeline implements EventTimelineReader {
  private readonly entriesByUnitId = new Map<string, TimelineEntry>();
  private _currentTime = initialReadyAt;

  constructor(participants: Iterable<TimelineParticipant>) {
    let registrationOrder = 0;
    for (const participant of participants) {
      if (this.entriesByUnitId.has(participant.id)) {
        throw new Error(`Timeline participant ${participant.id} is scheduled more than once`);
      }

      if (participant.isAlive) {
        this.entriesByUnitId.set(participant.id, {
          participant,
          registrationOrder,
          nextReadyAt: initialReadyAt,
        });
      }
      registrationOrder += 1;
    }
  }

  get currentTime(): number {
    this.removeDefeatedParticipants();
    return this._currentTime;
  }

  get readyActor(): TimelineActor | undefined {
    const entry = this.getNextEntry();
    return entry
      ? { unitId: entry.participant.id, nextReadyAt: entry.nextReadyAt }
      : undefined;
  }

  get presentation(): TimelinePresentation {
    const readyActor = this.readyActor;
    const readyEntry = readyActor
      ? this.entriesByUnitId.get(readyActor.unitId)
      : undefined;

    return {
      currentTime: this.currentTime,
      readyActorId: readyActor?.unitId,
      actionCosts: readyEntry
        ? getTimelineActionCosts(readyEntry.participant.tempo)
        : timelineActionCosts,
    };
  }

  getNextReadyAt(unitId: string): number | undefined {
    this.removeDefeatedParticipants();
    return this.entriesByUnitId.get(unitId)?.nextReadyAt;
  }

  /** An actor is ready only when it is the deterministic next event. */
  isReady(unitId: string): boolean {
    const readyActor = this.readyActor;
    return readyActor?.unitId === unitId && readyActor.nextReadyAt <= this._currentTime;
  }

  /**
   * Records the one action the current ready actor performed. Replacing the
   * entry is deliberate: this timeline has no stale duplicate events.
   */
  consumeReadyAction(unitId: string, action: TimelineAction): void {
    const entry = this.requireReadyEntry(unitId);
    entry.nextReadyAt = this._currentTime
      + getTimelineRecoveryDelay(action, entry.participant.tempo);
  }

  /** Explicitly removes a future event, for example when a unit is defeated. */
  invalidateUnit(unitId: string): void {
    this.entriesByUnitId.delete(unitId);
  }

  /**
   * Resolves one autonomous action for each non-Mage actor until the Mage is
   * the next decision point. This is an event-driven synchronous simulation
   * step; it never installs a timer or polls.
   */
  advanceAutonomousUnitsToMageDecision(
    mageId: string,
    resolveAutonomousAction: ResolveAutonomousTimelineAction,
  ): TimelineActor | undefined {
    this.removeDefeatedParticipants();
    const mage = this.entriesByUnitId.get(mageId);
    if (!mage) {
      return undefined;
    }
    if (mage.nextReadyAt < this._currentTime) {
      throw new Error(`Mage ${mageId} is scheduled before timeline time`);
    }

    let nextEntry = this.getNextEntry();
    while (nextEntry && nextEntry.participant.id !== mageId) {
      this._currentTime = nextEntry.nextReadyAt;
      const action = resolveAutonomousAction(nextEntry.participant);
      if (nextEntry.participant.isAlive) {
        nextEntry.nextReadyAt = this._currentTime
          + getTimelineRecoveryDelay(action, nextEntry.participant.tempo);
      } else {
        this.entriesByUnitId.delete(nextEntry.participant.id);
      }
      this.removeDefeatedParticipants();
      if (!this.entriesByUnitId.has(mageId)) {
        return undefined;
      }
      nextEntry = this.getNextEntry();
    }

    if (!nextEntry) {
      return undefined;
    }

    this._currentTime = nextEntry.nextReadyAt;
    return { unitId: nextEntry.participant.id, nextReadyAt: nextEntry.nextReadyAt };
  }

  private requireReadyEntry(unitId: string): TimelineEntry {
    this.removeDefeatedParticipants();
    const entry = this.entriesByUnitId.get(unitId);
    if (!entry || !this.isReady(unitId)) {
      throw new Error(`Timeline participant ${unitId} is not ready`);
    }

    return entry;
  }

  private getNextEntry(): TimelineEntry | undefined {
    this.removeDefeatedParticipants();

    let next: TimelineEntry | undefined;
    for (const entry of this.entriesByUnitId.values()) {
      if (!next
        || entry.nextReadyAt < next.nextReadyAt
        || (entry.nextReadyAt === next.nextReadyAt
          && entry.registrationOrder < next.registrationOrder)) {
        next = entry;
      }
    }

    return next;
  }

  private removeDefeatedParticipants(): void {
    for (const [unitId, entry] of this.entriesByUnitId) {
      if (!entry.participant.isAlive) {
        this.entriesByUnitId.delete(unitId);
      }
    }
  }
}

function getTimelineActionCosts(
  tempo: number,
): Readonly<Record<TimelineAction, number>> {
  return {
    [TimelineAction.Move]: getTimelineRecoveryDelay(TimelineAction.Move, tempo),
    [TimelineAction.Attack]: getTimelineRecoveryDelay(TimelineAction.Attack, tempo),
    [TimelineAction.Command]: getTimelineRecoveryDelay(TimelineAction.Command, tempo),
    [TimelineAction.Wait]: getTimelineRecoveryDelay(TimelineAction.Wait, tempo),
  };
}

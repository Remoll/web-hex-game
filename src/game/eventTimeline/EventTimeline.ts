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

/** Stable action names shared by autonomous-resolution callers. */
export enum TimelineAction {
  Move = "move",
  Attack = "attack",
  Wait = "wait",
}

/** Current tactical actions use AP; they do not set separate Timeline delays. */
export enum TacticalActionPointCost {
  Move = 1,
  Attack = 2,
  Wait = 0,
}

export const actionPointsPerActivation = 3;
export const baseTimelineRecoveryDelay = 100;
export const minimumTimelineRecoveryDelay = 1;

/** Returns the AP spent by a resolved tactical action. */
export function getTacticalActionPointCost(action: TimelineAction): number {
  switch (action) {
    case TimelineAction.Move:
      return TacticalActionPointCost.Move;
    case TimelineAction.Attack:
      return TacticalActionPointCost.Attack;
    case TimelineAction.Wait:
      return TacticalActionPointCost.Wait;
  }
}

/**
 * Converts a unit's Finesse-derived tempo into integer simulation time for its
 * next activation. Recovery is independent of the actions spent this turn.
 */
export function getTimelineRecoveryDelay(tempo: number): number {
  if (!Number.isInteger(tempo) || tempo <= 0) {
    throw new Error("Timeline tempo must be a positive integer");
  }

  return Math.max(
    minimumTimelineRecoveryDelay,
    Math.round(baseTimelineRecoveryDelay * baseTacticalTempo / tempo),
  );
}

export interface TimelineActor {
  readonly unitId: string;
  readonly nextReadyAt: number;
}

export interface TimelinePresentation {
  readonly currentTime: number;
  readonly readyActorId: string | undefined;
  readonly readyActorActionPoints: number | undefined;
  readonly actionPointsPerActivation: number;
  readonly readyActorHasWaited: boolean;
  readonly readyActorRecoveryDelay: number | undefined;
}

export interface EventTimelineReader {
  readonly currentTime: number;
  readonly readyActor: TimelineActor | undefined;
  readonly presentation: TimelinePresentation;
  getScheduledActors(): readonly TimelineActor[];
  getNextReadyAt(unitId: string): number | undefined;
  getRemainingActionPoints(unitId: string): number | undefined;
  hasWaitedDuringReadyActivation(unitId: string): boolean;
  isReady(unitId: string): boolean;
}

/** Resolves the next autonomous action for a non-Mage timeline entry. */
export type ResolveAutonomousTimelineAction = (
  participant: TimelineParticipant,
  remainingActionPoints: number,
) => TimelineAction;

interface TimelineEntry {
  readonly participant: TimelineParticipant;
  readonly registrationOrder: number;
  nextReadyAt: number;
  tieBreakOrder: number;
  remainingActionPoints: number;
  hasWaited: boolean;
}

const initialReadyAt = 0;
const noActionPoints = 0;

/**
 * A deterministic discrete-event scheduler. Each scheduled participant owns
 * one activation with a fixed AP pool. It only receives recovery after that
 * activation ends, so actions can be combined without creating stale events.
 */
export class EventTimeline implements EventTimelineReader {
  private readonly entriesByUnitId = new Map<string, TimelineEntry>();
  private _currentTime = initialReadyAt;
  private nextDeferredTieBreakOrder = 0;

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
          tieBreakOrder: registrationOrder,
          remainingActionPoints: actionPointsPerActivation,
          hasWaited: false,
        });
      }
      registrationOrder += 1;
    }

    this.nextDeferredTieBreakOrder = registrationOrder;
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
      readyActorActionPoints: readyEntry?.remainingActionPoints,
      actionPointsPerActivation,
      readyActorHasWaited: readyEntry?.hasWaited ?? false,
      readyActorRecoveryDelay: readyEntry
        ? getTimelineRecoveryDelay(readyEntry.participant.tempo)
        : undefined,
    };
  }

  getNextReadyAt(unitId: string): number | undefined {
    this.removeDefeatedParticipants();
    return this.entriesByUnitId.get(unitId)?.nextReadyAt;
  }

  /**
   * Returns the current scheduling order without exposing mutable timeline
   * entries. This query is intended for event-driven presentation syncs, never
   * render-frame polling.
   */
  getScheduledActors(): readonly TimelineActor[] {
    this.removeDefeatedParticipants();
    return [...this.entriesByUnitId.values()]
      .sort(compareTimelineEntries)
      .map((entry) => ({
        unitId: entry.participant.id,
        nextReadyAt: entry.nextReadyAt,
      }));
  }

  getRemainingActionPoints(unitId: string): number | undefined {
    this.removeDefeatedParticipants();
    return this.entriesByUnitId.get(unitId)?.remainingActionPoints;
  }

  hasWaitedDuringReadyActivation(unitId: string): boolean {
    this.removeDefeatedParticipants();
    return this.entriesByUnitId.get(unitId)?.hasWaited ?? false;
  }

  /** An actor is ready only when it is the deterministic next event. */
  isReady(unitId: string): boolean {
    const readyActor = this.readyActor;
    return readyActor?.unitId === unitId && readyActor.nextReadyAt <= this._currentTime;
  }

  /** Spends AP without rescheduling the active participant. */
  spendReadyActionPoints(unitId: string, cost: number): number {
    if (!Number.isInteger(cost) || cost < 0) {
      throw new Error("Action point cost must be a non-negative integer");
    }

    const entry = this.requireReadyEntry(unitId);
    if (entry.remainingActionPoints < cost) {
      throw new Error(`Timeline participant ${unitId} has insufficient action points`);
    }

    entry.remainingActionPoints -= cost;
    return entry.remainingActionPoints;
  }

  /**
   * Defers exactly once to the end of the actors currently ready at this time.
   * The participant remains in its activation and cannot wait again.
   */
  deferReadyActivation(unitId: string): void {
    const entry = this.requireReadyEntry(unitId);
    if (entry.hasWaited) {
      throw new Error(`Timeline participant ${unitId} already waited this activation`);
    }

    entry.hasWaited = true;
    entry.tieBreakOrder = this.nextDeferredTieBreakOrder;
    this.nextDeferredTieBreakOrder += 1;
  }

  /**
   * Applies the single Finesse-adjusted recovery delay after an activation.
   * Any unspent AP is intentionally discarded.
   */
  endReadyActivation(unitId: string): void {
    const entry = this.requireReadyEntry(unitId);
    entry.nextReadyAt = this._currentTime
      + getTimelineRecoveryDelay(entry.participant.tempo);
    entry.tieBreakOrder = entry.registrationOrder;
    entry.remainingActionPoints = actionPointsPerActivation;
    entry.hasWaited = false;
  }

  /** Explicitly removes a future event, for example when a unit is defeated. */
  invalidateUnit(unitId: string): void {
    this.entriesByUnitId.delete(unitId);
  }

  /**
   * Resolves autonomous actions for each non-Mage actor until the Mage is the
   * next decision point. An actor keeps resolving legal actions until it runs
   * out of AP or intentionally returns Wait. This is an event-driven
   * synchronous simulation step; it never installs a timer or polls.
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
      if (nextEntry.participant.isAlive) {
        this.resolveAutonomousActivation(nextEntry, resolveAutonomousAction);
        this.endReadyActivation(nextEntry.participant.id);
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

  private resolveAutonomousActivation(
    entry: TimelineEntry,
    resolveAutonomousAction: ResolveAutonomousTimelineAction,
  ): void {
    while (entry.participant.isAlive && entry.remainingActionPoints > noActionPoints) {
      const action = resolveAutonomousAction(
        entry.participant,
        entry.remainingActionPoints,
      );
      const actionPointCost = getTacticalActionPointCost(action);
      if (actionPointCost === noActionPoints
        || actionPointCost > entry.remainingActionPoints) {
        return;
      }

      this.spendReadyActionPoints(entry.participant.id, actionPointCost);
    }
  }

  private getNextEntry(): TimelineEntry | undefined {
    this.removeDefeatedParticipants();

    let next: TimelineEntry | undefined;
    for (const entry of this.entriesByUnitId.values()) {
      if (!next
        || entry.nextReadyAt < next.nextReadyAt
        || (entry.nextReadyAt === next.nextReadyAt
          && entry.tieBreakOrder < next.tieBreakOrder)) {
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

function compareTimelineEntries(
  first: TimelineEntry,
  second: TimelineEntry,
): number {
  return first.nextReadyAt - second.nextReadyAt
    || first.tieBreakOrder - second.tieBreakOrder;
}

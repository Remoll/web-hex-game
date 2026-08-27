import { describe, expect, it } from "vitest";
import {
  actionPointsPerActivation,
  baseTimelineRecoveryDelay,
  EventTimeline,
  getTimelineRecoveryDelay,
  TacticalActionPointCost,
  TimelineAction,
  type TimelineParticipant,
} from "@/game/eventTimeline/EventTimeline";
import { baseTacticalTempo } from "@/game/unit/tacticalAttributes/TacticalAttributes";

const initialSimulationTime = 0;

class Participant implements TimelineParticipant {
  public isAlive = true;

  constructor(
    public readonly id: string,
    public readonly tempo = baseTacticalTempo,
  ) {}
}

describe("EventTimeline", () => {
  it("keeps a ready actor active while it spends only part of its AP pool", () => {
    const beta = new Participant("beta");
    const alpha = new Participant("alpha");
    const timeline = new EventTimeline([beta, alpha]);

    expect(timeline.readyActor).toEqual({
      unitId: beta.id,
      nextReadyAt: initialSimulationTime,
    });
    expect(timeline.getRemainingActionPoints(beta.id)).toBe(actionPointsPerActivation);

    timeline.spendReadyActionPoints(beta.id, TacticalActionPointCost.Move);

    expect(timeline.readyActor).toEqual({
      unitId: beta.id,
      nextReadyAt: initialSimulationTime,
    });
    expect(timeline.getRemainingActionPoints(beta.id)).toBe(
      actionPointsPerActivation - TacticalActionPointCost.Move,
    );
    expect(timeline.getNextReadyAt(alpha.id)).toBe(initialSimulationTime);
  });

  it("rejects AP overspending and only schedules recovery after ending an activation", () => {
    const beta = new Participant("beta");
    const alpha = new Participant("alpha");
    const timeline = new EventTimeline([beta, alpha]);

    expect(() => timeline.spendReadyActionPoints(
      beta.id,
      actionPointsPerActivation + TacticalActionPointCost.Move,
    )).toThrow("Timeline participant beta has insufficient action points");

    timeline.spendReadyActionPoints(beta.id, actionPointsPerActivation);
    timeline.endReadyActivation(beta.id);

    expect(timeline.getNextReadyAt(beta.id)).toBe(baseTimelineRecoveryDelay);
    expect(timeline.getRemainingActionPoints(beta.id)).toBe(actionPointsPerActivation);
    expect(timeline.readyActor).toEqual({
      unitId: alpha.id,
      nextReadyAt: initialSimulationTime,
    });
  });

  it("uses Finesse-derived tempo for whole-activation recovery only", () => {
    const swift = new Participant("swift", 110);
    const timeline = new EventTimeline([swift]);

    expect(getTimelineRecoveryDelay(swift.tempo)).toBe(91);
    timeline.spendReadyActionPoints(swift.id, TacticalActionPointCost.Attack);
    expect(timeline.getNextReadyAt(swift.id)).toBe(initialSimulationTime);

    timeline.endReadyActivation(swift.id);
    expect(timeline.getNextReadyAt(swift.id)).toBe(91);
  });

  it("defers once behind the currently-ready actors and then exposes the same AP pool", () => {
    const mage = new Participant("mage");
    const enemy = new Participant("enemy");
    const neutral = new Participant("neutral");
    const timeline = new EventTimeline([mage, enemy, neutral]);
    const resolvedActorIds: string[] = [];

    timeline.deferReadyActivation(mage.id);
    expect(timeline.hasWaitedDuringReadyActivation(mage.id)).toBe(true);

    expect(timeline.advanceAutonomousUnitsToMageDecision(
      mage.id,
      (participant) => {
        resolvedActorIds.push(participant.id);
        return TimelineAction.Wait;
      },
    )).toEqual({
      unitId: mage.id,
      nextReadyAt: initialSimulationTime,
    });
    expect(resolvedActorIds).toEqual([enemy.id, neutral.id]);
    expect(timeline.getRemainingActionPoints(mage.id)).toBe(actionPointsPerActivation);
    expect(() => timeline.deferReadyActivation(mage.id)).toThrow(
      "Timeline participant mage already waited this activation",
    );

    timeline.endReadyActivation(mage.id);
    expect(timeline.getNextReadyAt(mage.id)).toBe(baseTimelineRecoveryDelay);
    expect(timeline.hasWaitedDuringReadyActivation(mage.id)).toBe(false);
  });

  it("keeps resolving autonomous actions until the AP pool is exhausted", () => {
    const servant = new Participant("servant");
    const mage = new Participant("mage");
    const timeline = new EventTimeline([servant, mage]);
    const actionPointSnapshots: number[] = [];

    expect(timeline.advanceAutonomousUnitsToMageDecision(
      mage.id,
      (_participant, remainingActionPoints) => {
        actionPointSnapshots.push(remainingActionPoints);
        return TimelineAction.Move;
      },
    )).toEqual({
      unitId: mage.id,
      nextReadyAt: initialSimulationTime,
    });
    expect(actionPointSnapshots).toEqual([
      actionPointsPerActivation,
      actionPointsPerActivation - TacticalActionPointCost.Move,
      actionPointsPerActivation
        - TacticalActionPointCost.Move
        - TacticalActionPointCost.Move,
    ]);
    expect(timeline.getNextReadyAt(servant.id)).toBe(baseTimelineRecoveryDelay);
    expect(timeline.getRemainingActionPoints(servant.id)).toBe(actionPointsPerActivation);
  });

  it("invalidates defeated participants before they can act", () => {
    const mage = new Participant("mage");
    const defeated = new Participant("defeated");
    const timeline = new EventTimeline([mage, defeated]);

    defeated.isAlive = false;
    expect(timeline.getNextReadyAt(defeated.id)).toBeUndefined();
    timeline.invalidateUnit(mage.id);

    expect(timeline.presentation).toEqual({
      currentTime: initialSimulationTime,
      readyActorId: undefined,
      readyActorActionPoints: undefined,
      actionPointsPerActivation,
      readyActorHasWaited: false,
      readyActorRecoveryDelay: undefined,
    });
  });
});

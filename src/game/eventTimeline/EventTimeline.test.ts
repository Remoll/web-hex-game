import { describe, expect, it } from "vitest";
import {
  actionPointsPerActivation,
  baseTimelineRecoveryDelay,
  EventTimeline,
  getTimelineRecoveryDelay,
  TacticalActionPointCost,
  TimelineAction,
  type ResolvedAutonomousTimelineAction,
  type TimelineParticipant,
} from "@/game/eventTimeline/EventTimeline";
import {
  groundUphillAdditionalActionPointCost,
  shallowWaterLeavingCostMultiplier,
} from "@/game/movement/GroundMovementRules";
import { baseTacticalTempo } from "@/game/unit/tacticalAttributes/TacticalAttributes";

const initialSimulationTime = 0;
const shallowWaterSameLevelOrDownhillActionPointCost = TacticalActionPointCost.Move
  * shallowWaterLeavingCostMultiplier;
const shallowWaterUphillActionPointCost
  = shallowWaterSameLevelOrDownhillActionPointCost
    + groundUphillAdditionalActionPointCost;

function createResolvedAutonomousMoveAction(
  actionPointCost: number,
): ResolvedAutonomousTimelineAction {
  return { action: TimelineAction.Move, actionPointCost };
}

function createResolvedAutonomousWaitAction(): ResolvedAutonomousTimelineAction {
  return { action: TimelineAction.Wait };
}

class Participant implements TimelineParticipant {
  public isAlive = true;

  constructor(
    public readonly id: string,
    public readonly tempo = baseTacticalTempo,
  ) {}
}

describe("EventTimeline", () => {
  it("keeps read projections side-effect free for externally defeated participants", () => {
    const participant = new Participant("participant");
    const timeline = new EventTimeline([participant]);

    participant.isAlive = false;

    expect(timeline.readyActor).toBeUndefined();
    expect(timeline.getScheduledActors()).toEqual([]);
    expect(timeline.getNextReadyAt(participant.id)).toBeUndefined();
    expect(timeline.getRemainingActionPoints(participant.id)).toBeUndefined();

    participant.isAlive = true;

    expect(timeline.readyActor).toEqual({
      unitId: participant.id,
      nextReadyAt: 0,
    });
    expect(timeline.getScheduledActors()).toEqual([{
      unitId: participant.id,
      nextReadyAt: 0,
    }]);
  });

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
        return createResolvedAutonomousWaitAction();
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

  it("projects upcoming actors in deterministic scheduling order", () => {
    const mage = new Participant("mage");
    const enemy = new Participant("enemy");
    const neutral = new Participant("neutral");
    const timeline = new EventTimeline([mage, enemy, neutral]);

    expect(timeline.getScheduledActors()).toEqual([
      { unitId: mage.id, nextReadyAt: initialSimulationTime },
      { unitId: enemy.id, nextReadyAt: initialSimulationTime },
      { unitId: neutral.id, nextReadyAt: initialSimulationTime },
    ]);

    timeline.deferReadyActivation(mage.id);
    expect(timeline.getScheduledActors()).toEqual([
      { unitId: enemy.id, nextReadyAt: initialSimulationTime },
      { unitId: neutral.id, nextReadyAt: initialSimulationTime },
      { unitId: mage.id, nextReadyAt: initialSimulationTime },
    ]);

    enemy.isAlive = false;
    expect(timeline.getScheduledActors()).toEqual([
      { unitId: neutral.id, nextReadyAt: initialSimulationTime },
      { unitId: mage.id, nextReadyAt: initialSimulationTime },
    ]);
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
        return createResolvedAutonomousMoveAction(TacticalActionPointCost.Move);
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

  it("charges an autonomous move at its exact resolved uphill AP cost", () => {
    const climber = new Participant("climber");
    const mage = new Participant("mage");
    const timeline = new EventTimeline([climber, mage]);
    const actionPointSnapshots: number[] = [];

    timeline.advanceAutonomousUnitsToMageDecision(
      mage.id,
      (_participant, remainingActionPoints) => {
        actionPointSnapshots.push(remainingActionPoints);
        return actionPointSnapshots.length === 1
          ? createResolvedAutonomousMoveAction(TacticalActionPointCost.MoveUphill)
          : createResolvedAutonomousWaitAction();
      },
    );

    expect(actionPointSnapshots).toEqual([
      actionPointsPerActivation,
      actionPointsPerActivation - TacticalActionPointCost.MoveUphill,
    ]);
  });

  it("charges autonomous Shallow Water moves with their exact resolved AP costs", () => {
    const shallowWalker = new Participant("shallow-walker");
    const mage = new Participant("mage");
    const shallowWalkTimeline = new EventTimeline([shallowWalker, mage]);
    const shallowWalkActionPointSnapshots: number[] = [];

    shallowWalkTimeline.advanceAutonomousUnitsToMageDecision(
      mage.id,
      (_participant, remainingActionPoints) => {
        shallowWalkActionPointSnapshots.push(remainingActionPoints);
        return shallowWalkActionPointSnapshots.length === 1
          ? createResolvedAutonomousMoveAction(
            shallowWaterSameLevelOrDownhillActionPointCost,
          )
          : createResolvedAutonomousWaitAction();
      },
    );

    expect(shallowWalkActionPointSnapshots).toEqual([
      actionPointsPerActivation,
      actionPointsPerActivation - shallowWaterSameLevelOrDownhillActionPointCost,
    ]);

    const shallowClimber = new Participant("shallow-climber");
    const shallowClimbTimeline = new EventTimeline([shallowClimber, mage]);
    const shallowClimbActionPointSnapshots: number[] = [];

    shallowClimbTimeline.advanceAutonomousUnitsToMageDecision(
      mage.id,
      (_participant, remainingActionPoints) => {
        shallowClimbActionPointSnapshots.push(remainingActionPoints);
        return createResolvedAutonomousMoveAction(shallowWaterUphillActionPointCost);
      },
    );

    expect(shallowClimbActionPointSnapshots).toEqual([
      actionPointsPerActivation,
    ]);
    expect(shallowClimbTimeline.getNextReadyAt(shallowClimber.id)).toBe(
      baseTimelineRecoveryDelay,
    );
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

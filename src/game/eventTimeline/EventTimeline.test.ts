import { describe, expect, it } from "vitest";
import {
  EventTimeline,
  TimelineAction,
  getTimelineRecoveryDelay,
  timelineActionCosts,
  type TimelineParticipant,
} from "@/game/eventTimeline/EventTimeline";
import { baseTacticalTempo } from "@/game/unit/tacticalAttributes/TacticalAttributes";

class Participant implements TimelineParticipant {
  public isAlive = true;

  constructor(
    public readonly id: string,
    public readonly tempo = baseTacticalTempo,
  ) {}
}

describe("EventTimeline", () => {
  it("uses integer named costs and stable registration-order tie breaking", () => {
    const beta = new Participant("beta");
    const alpha = new Participant("alpha");
    const timeline = new EventTimeline([beta, alpha]);

    expect(timelineActionCosts).toEqual({
      [TimelineAction.Move]: 100,
      [TimelineAction.Attack]: 140,
      [TimelineAction.Command]: 100,
      [TimelineAction.Wait]: 100,
    });
    expect(timeline.readyActor).toEqual({ unitId: "beta", nextReadyAt: 0 });

    timeline.consumeReadyAction("beta", TimelineAction.Move);
    expect(timeline.readyActor).toEqual({ unitId: "alpha", nextReadyAt: 0 });
    expect(timeline.isReady("beta")).toBe(false);
    expect(() => timeline.consumeReadyAction("beta", TimelineAction.Attack)).toThrow(
      "Timeline participant beta is not ready",
    );
  });

  it("resolves passive waits in the documented registration order", () => {
    const enemy = new Participant("enemy");
    const mage = new Participant("mage");
    const timeline = new EventTimeline([enemy, mage]);

    expect(advanceToMageDecision(timeline, mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 0,
    });
    expect(timeline.getNextReadyAt(enemy.id)).toBe(100);

    timeline.consumeReadyAction(mage.id, TimelineAction.Move);
    expect(advanceToMageDecision(timeline, mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 100,
    });
    expect(timeline.getNextReadyAt(enemy.id)).toBe(200);
  });

  it("schedules the one autonomous action selected for each passive actor", () => {
    const servant = new Participant("servant");
    const mage = new Participant("mage");
    const timeline = new EventTimeline([servant, mage]);
    const resolvedActorIds: string[] = [];

    expect(timeline.advanceAutonomousUnitsToMageDecision(
      mage.id,
      (participant) => {
        resolvedActorIds.push(participant.id);
        return TimelineAction.Attack;
      },
    )).toEqual({
      unitId: mage.id,
      nextReadyAt: 0,
    });
    expect(resolvedActorIds).toEqual([servant.id]);
    expect(timeline.getNextReadyAt(servant.id)).toBe(
      timelineActionCosts[TimelineAction.Attack],
    );
  });

  it("ends autonomous resolution safely when an action defeats the Mage", () => {
    const servant = new Participant("servant");
    const mage = new Participant("mage");
    const timeline = new EventTimeline([servant, mage]);

    expect(timeline.advanceAutonomousUnitsToMageDecision(
      mage.id,
      () => {
        mage.isAlive = false;
        return TimelineAction.Attack;
      },
    )).toBeUndefined();
    expect(timeline.readyActor).toEqual({
      unitId: servant.id,
      nextReadyAt: timelineActionCosts[TimelineAction.Attack],
    });
  });

  it("uses a unit's tempo for the next recovery delay", () => {
    const swift = new Participant("swift", 110);
    const timeline = new EventTimeline([swift]);

    expect(getTimelineRecoveryDelay(TimelineAction.Move, swift.tempo)).toBe(91);
    expect(getTimelineRecoveryDelay(TimelineAction.Attack, swift.tempo)).toBe(127);
    timeline.consumeReadyAction(swift.id, TimelineAction.Move);
    expect(timeline.getNextReadyAt(swift.id)).toBe(91);
  });

  it("advances passive units through Wait events to the next Mage decision", () => {
    const mage = new Participant("mage");
    const enemy = new Participant("enemy");
    const neutral = new Participant("neutral");
    const timeline = new EventTimeline([mage, enemy, neutral]);

    expect(advanceToMageDecision(timeline, mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 0,
    });
    expect(timeline.getNextReadyAt(enemy.id)).toBe(0);
    expect(timeline.getNextReadyAt(neutral.id)).toBe(0);

    timeline.consumeReadyAction(mage.id, TimelineAction.Move);
    expect(advanceToMageDecision(timeline, mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 100,
    });
    expect(timeline.currentTime).toBe(100);
    expect(timeline.getNextReadyAt(enemy.id)).toBe(100);

    timeline.consumeReadyAction(mage.id, TimelineAction.Attack);
    expect(advanceToMageDecision(timeline, mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 240,
    });
    expect(timeline.currentTime).toBe(240);
    expect(timeline.getNextReadyAt(enemy.id)).toBe(300);
  });

  it("invalidates explicitly stale and defeated participants before they can act", () => {
    const mage = new Participant("mage");
    const defeated = new Participant("defeated");
    const timeline = new EventTimeline([mage, defeated]);

    defeated.isAlive = false;
    expect(timeline.getNextReadyAt(defeated.id)).toBeUndefined();
    expect(advanceToMageDecision(timeline, mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 0,
    });

    timeline.invalidateUnit(mage.id);
    expect(timeline.readyActor).toBeUndefined();
    expect(advanceToMageDecision(timeline, mage.id)).toBeUndefined();
    expect(timeline.presentation).toEqual({
      currentTime: 0,
      readyActorId: undefined,
      actionCosts: timelineActionCosts,
    });
  });
});

function advanceToMageDecision(
  timeline: EventTimeline,
  mageId: string,
) {
  return timeline.advanceAutonomousUnitsToMageDecision(
    mageId,
    () => TimelineAction.Wait,
  );
}

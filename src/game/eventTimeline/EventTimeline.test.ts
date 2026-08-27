import { describe, expect, it } from "vitest";
import {
  EventTimeline,
  TimelineAction,
  timelineActionCosts,
  type TimelineParticipant,
} from "@/game/eventTimeline/EventTimeline";

class Participant implements TimelineParticipant {
  public isAlive = true;

  constructor(public readonly id: string) {}
}

describe("EventTimeline", () => {
  it("uses integer named costs and stable registration-order tie breaking", () => {
    const beta = new Participant("beta");
    const alpha = new Participant("alpha");
    const timeline = new EventTimeline([beta, alpha]);

    expect(timelineActionCosts).toEqual({
      [TimelineAction.Move]: 100,
      [TimelineAction.Attack]: 140,
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

    expect(timeline.advancePassiveUnitsToMageDecision(mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 0,
    });
    expect(timeline.getNextReadyAt(enemy.id)).toBe(100);

    timeline.consumeReadyAction(mage.id, TimelineAction.Move);
    expect(timeline.advancePassiveUnitsToMageDecision(mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 100,
    });
    expect(timeline.getNextReadyAt(enemy.id)).toBe(200);
  });

  it("advances passive units through Wait events to the next Mage decision", () => {
    const mage = new Participant("mage");
    const enemy = new Participant("enemy");
    const neutral = new Participant("neutral");
    const timeline = new EventTimeline([mage, enemy, neutral]);

    expect(timeline.advancePassiveUnitsToMageDecision(mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 0,
    });
    expect(timeline.getNextReadyAt(enemy.id)).toBe(0);
    expect(timeline.getNextReadyAt(neutral.id)).toBe(0);

    timeline.consumeReadyAction(mage.id, TimelineAction.Move);
    expect(timeline.advancePassiveUnitsToMageDecision(mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 100,
    });
    expect(timeline.currentTime).toBe(100);
    expect(timeline.getNextReadyAt(enemy.id)).toBe(100);

    timeline.consumeReadyAction(mage.id, TimelineAction.Attack);
    expect(timeline.advancePassiveUnitsToMageDecision(mage.id)).toEqual({
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
    expect(timeline.advancePassiveUnitsToMageDecision(mage.id)).toEqual({
      unitId: mage.id,
      nextReadyAt: 0,
    });

    timeline.invalidateUnit(mage.id);
    expect(timeline.readyActor).toBeUndefined();
    expect(timeline.advancePassiveUnitsToMageDecision(mage.id)).toBeUndefined();
    expect(timeline.presentation).toEqual({
      currentTime: 0,
      readyActorId: undefined,
      actionCosts: timelineActionCosts,
    });
  });
});

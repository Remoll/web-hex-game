// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  actionPointsPerActivation,
  type TimelinePresentation,
} from "@/game/eventTimeline/EventTimeline";
import { TimelineHud } from "@/app/timelineHud/TimelineHud";

const mageId = "mage";

afterEach(() => {
  document.body.replaceChildren();
});

function createPresentation(
  overrides: Partial<TimelinePresentation> = {},
): TimelinePresentation {
  return {
    currentTime: 120,
    readyActorId: mageId,
    readyActorActionPoints: actionPointsPerActivation,
    actionPointsPerActivation,
    readyActorHasWaited: false,
    readyActorRecoveryDelay: 100,
    ...overrides,
  };
}

describe("TimelineHud", () => {
  it("renders accessible timeline labels, AP costs, and persistent Mage controls", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const hud = new TimelineHud({
      container,
      mageId,
      onWait: vi.fn(),
      onEndTurn: vi.fn(),
    });

    hud.sync(createPresentation());
    const root = container.querySelector(".timeline-hud");
    const activationControls = container.querySelector(".timeline-hud__activation-controls");
    const waitButton = container.querySelector<HTMLButtonElement>(".timeline-hud__wait");
    const endTurnButton = container.querySelector<HTMLButtonElement>(".timeline-hud__end-turn");

    expect(root?.getAttribute("aria-label")).toBe("Tactical timeline");
    expect(activationControls?.getAttribute("role")).toBe("group");
    expect(activationControls?.getAttribute("aria-label")).toBe("Mage activation controls");
    expect(root?.textContent).toContain("Time: 120");
    expect(root?.textContent).toContain("Ready: Mage");
    expect(root?.textContent).toContain(`AP: ${actionPointsPerActivation}/${actionPointsPerActivation}`);
    expect(root?.textContent).toContain("Move 1 AP (2 uphill)");
    expect(root?.textContent).toContain("Attack 2 AP");
    expect(root?.textContent).toContain("Command 1 AP");
    expect(waitButton?.textContent).toBe("Wait");
    expect(waitButton?.getAttribute("aria-label")).toBe("Wait");
    expect(waitButton?.disabled).toBe(false);
    expect(endTurnButton?.textContent).toBe("End Turn +100");
    expect(endTurnButton?.getAttribute("aria-label")).toBe("End Turn +100");
    expect(endTurnButton?.disabled).toBe(false);

    waitButton?.focus();
    expect(document.activeElement).toBe(waitButton);
    endTurnButton?.focus();
    expect(document.activeElement).toBe(endTurnButton);

    hud.sync(createPresentation({
      readyActorActionPoints: 0,
      readyActorHasWaited: true,
    }));
    expect(waitButton?.textContent).toBe("Wait");
    expect(waitButton?.disabled).toBe(true);
    expect(endTurnButton?.textContent).toBe("End Turn +100");
    expect(endTurnButton?.disabled).toBe(false);
    expect(root?.textContent).toContain(`AP: 0/${actionPointsPerActivation}`);
  });

  it("routes Mage Wait and End Turn separately, disables unavailable controls, and removes listeners on dispose", () => {
    const container = document.createElement("div");
    const onWait = vi.fn();
    const onEndTurn = vi.fn();
    const hud = new TimelineHud({ container, mageId, onWait, onEndTurn });
    hud.sync(createPresentation());
    const waitButton = container.querySelector<HTMLButtonElement>(".timeline-hud__wait")!;
    const endTurnButton = container.querySelector<HTMLButtonElement>(".timeline-hud__end-turn")!;

    waitButton.click();
    expect(onWait).toHaveBeenCalledTimes(1);
    expect(onEndTurn).not.toHaveBeenCalled();
    endTurnButton.click();
    expect(onEndTurn).toHaveBeenCalledTimes(1);

    hud.sync(createPresentation({ readyActorHasWaited: true }));
    expect(waitButton.disabled).toBe(true);
    waitButton.click();
    expect(onWait).toHaveBeenCalledTimes(1);
    expect(endTurnButton.disabled).toBe(false);

    hud.sync(createPresentation({ readyActorId: "enemy" }));
    expect(waitButton.disabled).toBe(true);
    expect(endTurnButton.disabled).toBe(true);
    endTurnButton.click();
    expect(onEndTurn).toHaveBeenCalledTimes(1);

    hud.dispose();
    expect(container.children).toHaveLength(0);
    waitButton.disabled = false;
    endTurnButton.disabled = false;
    waitButton.click();
    endTurnButton.click();
    expect(onWait).toHaveBeenCalledTimes(1);
    expect(onEndTurn).toHaveBeenCalledTimes(1);
  });
});

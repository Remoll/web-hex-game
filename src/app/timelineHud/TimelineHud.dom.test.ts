// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { TimelinePresentation } from "@/game/eventTimeline/EventTimeline";
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
    readyActorActionPoints: 3,
    actionPointsPerActivation: 3,
    readyActorHasWaited: false,
    readyActorRecoveryDelay: 100,
    ...overrides,
  };
}

describe("TimelineHud", () => {
  it("renders the accessible timeline labels, AP costs, and Wait state", () => {
    const container = document.createElement("div");
    const hud = new TimelineHud({
      container,
      mageId,
      onWait: vi.fn(),
    });

    hud.sync(createPresentation());
    const root = container.querySelector(".timeline-hud");
    const waitButton = container.querySelector<HTMLButtonElement>("button");

    expect(root?.getAttribute("aria-label")).toBe("Tactical timeline");
    expect(root?.textContent).toContain("Time: 120");
    expect(root?.textContent).toContain("Ready: Mage");
    expect(root?.textContent).toContain("AP: 3/3");
    expect(root?.textContent).toContain("Move 1 AP (2 uphill)");
    expect(root?.textContent).toContain("Attack 2 AP");
    expect(root?.textContent).toContain("Command 1 AP");
    expect(waitButton?.textContent).toBe("Wait");
    expect(waitButton?.disabled).toBe(false);

    hud.sync(createPresentation({
      readyActorActionPoints: 0,
      readyActorHasWaited: true,
    }));
    expect(waitButton?.textContent).toBe("End Turn +100");
    expect(root?.textContent).toContain("AP: 0/3");
  });

  it("enables Wait only for the Mage, invokes it on click, and removes the listener on dispose", () => {
    const container = document.createElement("div");
    const onWait = vi.fn();
    const hud = new TimelineHud({ container, mageId, onWait });
    hud.sync(createPresentation());
    const waitButton = container.querySelector<HTMLButtonElement>("button")!;

    waitButton.click();
    expect(onWait).toHaveBeenCalledTimes(1);

    hud.sync(createPresentation({ readyActorId: "enemy" }));
    expect(waitButton.disabled).toBe(true);
    waitButton.click();
    expect(onWait).toHaveBeenCalledTimes(1);

    hud.dispose();
    expect(container.children).toHaveLength(0);
    waitButton.disabled = false;
    waitButton.click();
    expect(onWait).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { AreaTravelHud } from "@/app/areaTravelHud/AreaTravelHud";

afterEach(() => {
  document.body.replaceChildren();
});

describe("AreaTravelHud", () => {
  it("exposes an accessible explicit Enter action only when the route is available", () => {
    const onTravel = vi.fn();
    const hud = new AreaTravelHud({ container: document.body, onTravel });

    hud.sync({
      areaName: "Strategic Map",
      guidance: "Move the party to the highlighted entrance to enter.",
      actionLabel: "Reach highlighted entrance",
      canTravel: false,
      isInputLocked: false,
    });
    const button = document.querySelector<HTMLButtonElement>(".area-travel-hud__button");
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute("aria-label")).toBe("Reach highlighted entrance");
    expect(document.querySelector(".area-travel-hud__guidance")?.textContent).toBe(
      "Move the party to the highlighted entrance to enter.",
    );

    hud.sync({
      areaName: "Strategic Map",
      guidance: "At the highlighted entrance.",
      actionLabel: "Enter Existing Tactical Map",
      canTravel: true,
      isInputLocked: false,
    });
    button?.click();
    expect(onTravel).toHaveBeenCalledOnce();

    hud.sync({
      areaName: "Existing Tactical Map",
      guidance: "At the highlighted exit.",
      actionLabel: "Return to Strategic Map",
      canTravel: true,
      isInputLocked: true,
    });
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toBe("Return to Strategic Map");

    hud.sync({
      areaName: "Cobblestone Tower Ground Floor",
      guidance: "At the highlighted exit.",
      actionLabel: "Enter Cobblestone Tower Upper Floor",
      canTravel: true,
      isInputLocked: false,
    });
    expect(button?.disabled).toBe(false);
    expect(button?.getAttribute("aria-label")).toBe(
      "Enter Cobblestone Tower Upper Floor",
    );

    hud.dispose();
  });
});

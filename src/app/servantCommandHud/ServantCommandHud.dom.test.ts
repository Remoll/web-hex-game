// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ServantStrategyTargetSelection,
  type ServantCommandPresentation,
} from "@/game/gameSession/GameSession";
import { ServantStrategyType } from "@/game/unit/servantStrategy/ServantStrategy";
import { ServantCommandHud } from "@/app/servantCommandHud/ServantCommandHud";

afterEach(() => {
  document.body.replaceChildren();
});

function createPresentation(
  overrides: Partial<ServantCommandPresentation> = {},
): ServantCommandPresentation {
  return {
    targetServantId: "servant-1",
    targetStrategyType: undefined,
    visiblePursuitTargetId: undefined,
    visibleSecureTargetHex: undefined,
    canAssignHold: true,
    canAssignPursue: true,
    canAssignSecure: true,
    canAssignProtect: true,
    canClearStrategy: false,
    targetSelection: undefined,
    ...overrides,
  };
}

describe("ServantCommandHud", () => {
  it("renders AP-labelled commands and routes enabled button clicks", () => {
    const container = document.createElement("div");
    const callbacks = {
      onAssignHold: vi.fn(),
      onAssignProtect: vi.fn(),
      onBeginPursue: vi.fn(),
      onBeginSecure: vi.fn(),
      onClearStrategy: vi.fn(),
    };
    const hud = new ServantCommandHud({ container, ...callbacks });
    hud.sync(createPresentation());

    const root = container.querySelector(".servant-command-hud");
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    expect(root?.getAttribute("aria-label")).toBe("Servant strategy command");
    expect(root?.textContent).toContain("Servant: servant-1 · Strategy: None");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Assign Hold (1 AP)",
      "Assign Protect Mage (1 AP)",
      "Assign Pursue (1 AP)",
      "Assign Secure (1 AP)",
      "Clear strategy (1 AP)",
    ]);
    expect(buttons.slice(0, 4).every((button) => !button.disabled)).toBe(true);
    expect(buttons[4].disabled).toBe(true);

    buttons[0].click();
    buttons[1].click();
    buttons[2].click();
    buttons[3].click();
    expect(callbacks.onAssignHold).toHaveBeenCalledOnce();
    expect(callbacks.onAssignProtect).toHaveBeenCalledOnce();
    expect(callbacks.onBeginPursue).toHaveBeenCalledOnce();
    expect(callbacks.onBeginSecure).toHaveBeenCalledOnce();
    expect(callbacks.onClearStrategy).not.toHaveBeenCalled();
  });

  it("presents target-selection cancellation and removes callbacks on dispose", () => {
    const container = document.createElement("div");
    const onClearStrategy = vi.fn();
    const hud = new ServantCommandHud({
      container,
      onAssignHold: vi.fn(),
      onAssignProtect: vi.fn(),
      onBeginPursue: vi.fn(),
      onBeginSecure: vi.fn(),
      onClearStrategy,
    });
    hud.sync(createPresentation({
      targetStrategyType: ServantStrategyType.Hold,
      targetSelection: ServantStrategyTargetSelection.PursueEnemy,
      canAssignHold: false,
      canAssignProtect: false,
      canAssignPursue: false,
      canAssignSecure: false,
      canClearStrategy: true,
    }));

    const root = container.querySelector(".servant-command-hud");
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    const cancelButton = buttons[4];
    expect(root?.textContent).toContain("Select a visible Enemy");
    expect(buttons.slice(0, 4).every((button) => button.disabled)).toBe(true);
    expect(cancelButton.textContent).toBe("Cancel target selection");
    expect(cancelButton.disabled).toBe(false);

    cancelButton.click();
    expect(onClearStrategy).toHaveBeenCalledOnce();

    hud.dispose();
    expect(container.children).toHaveLength(0);
    cancelButton.click();
    expect(onClearStrategy).toHaveBeenCalledOnce();
  });
});

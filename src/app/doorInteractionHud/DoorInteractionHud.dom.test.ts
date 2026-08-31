// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { DoorBlockInitialState } from "@/game/board/structure/TacticalHexStructure";
import type { DoorBlockInteractionPresentation } from "@/game/gameSession/GameSession";
import { DoorInteractionHud } from "@/app/doorInteractionHud/DoorInteractionHud";

afterEach(() => {
  document.body.replaceChildren();
});

function createPresentation(
  overrides: Partial<DoorBlockInteractionPresentation> = {},
): DoorBlockInteractionPresentation {
  return {
    mageId: "mage",
    doorBlockId: "door",
    currentState: DoorBlockInitialState.Closed,
    canOpen: true,
    canClose: false,
    enterActionPointCost: undefined,
    ...overrides,
  };
}

describe("DoorInteractionHud", () => {
  it("shows a closed-door Open action and routes its click", () => {
    const container = document.createElement("div");
    const callbacks = {
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onEnter: vi.fn(),
      onDismiss: vi.fn(),
    };
    const hud = new DoorInteractionHud({ container, ...callbacks });

    hud.sync(createPresentation());

    const root = container.querySelector<HTMLElement>(".door-interaction-hud");
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    expect(root?.hidden).toBe(false);
    expect(root?.getAttribute("role")).toBe("dialog");
    expect(root?.textContent).toContain("Closed door");
    expect(buttons.map((button) => ({ text: button.textContent, hidden: button.hidden }))).toEqual([
      { text: "Open door (1 AP)", hidden: false },
      { text: "Close door (1 AP)", hidden: true },
      { text: "Enter (— AP)", hidden: true },
      { text: "Cancel", hidden: false },
    ]);

    buttons[0]?.click();
    expect(callbacks.onOpen).toHaveBeenCalledOnce();
  });

  it("shows Open-door Enter and Close actions with their current availability", () => {
    const container = document.createElement("div");
    const callbacks = {
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onEnter: vi.fn(),
      onDismiss: vi.fn(),
    };
    const hud = new DoorInteractionHud({ container, ...callbacks });

    hud.sync(createPresentation({
      currentState: DoorBlockInitialState.Open,
      canOpen: false,
      canClose: true,
      enterActionPointCost: 2,
    }));

    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons.map((button) => ({
      text: button.textContent,
      hidden: button.hidden,
      disabled: button.disabled,
    }))).toEqual([
      { text: "Open door (1 AP)", hidden: true, disabled: true },
      { text: "Close door (1 AP)", hidden: false, disabled: false },
      { text: "Enter (2 AP)", hidden: false, disabled: false },
      { text: "Cancel", hidden: false, disabled: false },
    ]);

    buttons[1]?.click();
    buttons[2]?.click();
    buttons[3]?.click();
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    expect(callbacks.onEnter).toHaveBeenCalledOnce();
    expect(callbacks.onDismiss).toHaveBeenCalledOnce();

    hud.sync(undefined);
    expect(container.querySelector<HTMLElement>(".door-interaction-hud")?.hidden).toBe(true);
  });
});

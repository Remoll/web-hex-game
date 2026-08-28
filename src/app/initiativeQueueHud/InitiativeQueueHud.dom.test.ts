// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InitiativeQueueActorLabel,
  InitiativeQueueCardState,
  type InitiativeQueueEntry,
  type InitiativeQueuePresentation,
} from "@/game/gameSession/GameSession";
import { InitiativeQueueHud } from "@/app/initiativeQueueHud/InitiativeQueueHud";

afterEach(() => {
  document.body.replaceChildren();
});

const knownMageCard = {
  cardId: "mage-card",
  state: InitiativeQueueCardState.Identified,
  label: InitiativeQueueActorLabel.Mage,
  unitId: "mage",
  isCurrent: true,
  canHighlight: true,
} as const;

const unknownEnemyCard = {
  cardId: "unknown-card",
  state: InitiativeQueueCardState.Unknown,
  label: InitiativeQueueActorLabel.Enemy,
  unitId: "hidden-enemy-id",
  isCurrent: false,
  canHighlight: false,
} as const;

const hiddenEnemyCard = {
  cardId: "hidden-enemy-card",
  state: InitiativeQueueCardState.Identified,
  label: InitiativeQueueActorLabel.Enemy,
  unitId: "discovered-enemy",
  isCurrent: false,
  canHighlight: false,
} as const;

function createPresentation(
  entries: readonly InitiativeQueueEntry[] = [knownMageCard, unknownEnemyCard],
): InitiativeQueuePresentation {
  return { entries };
}

function dispatchFocusEvent(
  target: HTMLElement,
  type: "focusin" | "focusout",
  relatedTarget: EventTarget | null,
): void {
  target.dispatchEvent(new FocusEvent(type, { bubbles: true, relatedTarget }));
}

describe("InitiativeQueueHud", () => {
  it("renders semantic queue cards and protects unknown-card identity under fog", () => {
    const container = document.createElement("div");
    const hud = new InitiativeQueueHud({
      container,
      onHighlightUnit: vi.fn(),
      onClearHighlight: vi.fn(),
    });
    hud.sync(createPresentation());

    const root = container.querySelector(".initiative-queue-hud");
    const cards = [...container.querySelectorAll<HTMLButtonElement>("button")];
    const [mageCard, unknownCard] = cards;
    expect(root?.getAttribute("aria-label")).toBe("Upcoming initiative order");
    expect(container.querySelector("[role='list']")).toBeTruthy();
    expect(mageCard.getAttribute("role")).toBe("listitem");
    expect(mageCard.getAttribute("aria-label")).toBe("Mage current actor, visible");
    expect(mageCard.textContent).toContain("Mage");
    expect(mageCard.textContent).toContain("Now");
    expect(mageCard.disabled).toBe(false);
    expect(unknownCard.getAttribute("aria-label")).toBe("Unknown upcoming actor");
    expect(unknownCard.textContent).toContain("Unknown");
    expect(unknownCard.textContent).toContain("?");
    expect(unknownCard.disabled).toBe(true);
    expect(unknownCard.dataset.highlightUnitId).toBe("");
    expect(unknownCard.textContent).not.toContain("Enemy");
    expect(unknownCard.textContent).not.toContain("hidden-enemy-id");
    expect(unknownCard.getAttribute("aria-label")).not.toContain("hidden-enemy-id");
  });

  it("keeps discovered but hidden cards identifiable without exposing an interaction target", () => {
    const container = document.createElement("div");
    const onHighlightUnit = vi.fn();
    const onClearHighlight = vi.fn();
    const hud = new InitiativeQueueHud({
      container,
      onHighlightUnit,
      onClearHighlight,
    });

    hud.sync(createPresentation([hiddenEnemyCard]));

    const card = container.querySelector<HTMLButtonElement>("button");
    if (!card) {
      throw new Error("Expected the hidden enemy card to be rendered.");
    }

    expect(card.textContent).toContain(InitiativeQueueActorLabel.Enemy);
    expect(card.getAttribute("aria-label")).toBe(
      "Enemy upcoming actor, location hidden",
    );
    expect(card.disabled).toBe(true);
    expect(card.dataset.highlightUnitId).toBe("");

    card.dispatchEvent(new Event("pointerover", { bubbles: true }));

    expect(onHighlightUnit).not.toHaveBeenCalled();
    expect(onClearHighlight).not.toHaveBeenCalled();

    hud.dispose();
  });

  it("handles pointer, focus, and click interaction while preserving highlights within the queue", () => {
    const container = document.createElement("div");
    const onHighlightUnit = vi.fn();
    const onClearHighlight = vi.fn();
    const hud = new InitiativeQueueHud({ container, onHighlightUnit, onClearHighlight });
    const servantCard = {
      cardId: "servant-card",
      state: InitiativeQueueCardState.Identified,
      label: InitiativeQueueActorLabel.Servant,
      unitId: "servant",
      isCurrent: false,
      canHighlight: true,
    } as const;
    hud.sync(createPresentation([knownMageCard, servantCard, unknownEnemyCard]));
    const cards = [...container.querySelectorAll<HTMLButtonElement>("button")];
    const [mageCard, secondCard, unknownCard] = cards;

    mageCard.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(onHighlightUnit).toHaveBeenLastCalledWith("mage");
    mageCard.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    expect(onClearHighlight).toHaveBeenCalledOnce();

    dispatchFocusEvent(mageCard, "focusin", null);
    expect(onHighlightUnit).toHaveBeenLastCalledWith("mage");
    dispatchFocusEvent(mageCard, "focusout", secondCard);
    expect(onClearHighlight).toHaveBeenCalledOnce();
    dispatchFocusEvent(secondCard, "focusin", mageCard);
    expect(onHighlightUnit).toHaveBeenLastCalledWith("servant");
    dispatchFocusEvent(secondCard, "focusout", null);
    expect(onClearHighlight).toHaveBeenCalledTimes(2);

    secondCard.click();
    expect(onHighlightUnit).toHaveBeenLastCalledWith("servant");
    unknownCard.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(onClearHighlight).toHaveBeenCalledTimes(3);
  });

  it("clears active state on sync and removes delegated interaction listeners on dispose", () => {
    const container = document.createElement("div");
    const onHighlightUnit = vi.fn();
    const onClearHighlight = vi.fn();
    const hud = new InitiativeQueueHud({ container, onHighlightUnit, onClearHighlight });
    hud.sync(createPresentation([knownMageCard]));
    const mageCard = container.querySelector<HTMLButtonElement>("button")!;
    mageCard.click();
    expect(onHighlightUnit).toHaveBeenCalledWith("mage");

    hud.sync(createPresentation([knownMageCard]));
    expect(onClearHighlight).toHaveBeenCalledOnce();

    hud.dispose();
    expect(container.children).toHaveLength(0);
    mageCard.click();
    mageCard.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    expect(onHighlightUnit).toHaveBeenCalledOnce();
    expect(onClearHighlight).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it } from "vitest";
import {
  InitiativeQueueCardState,
  InitiativeQueueActorLabel,
  type InitiativeQueueEntry,
} from "@/game/gameSession/GameSession";
import { getInitiativeQueueHighlightTarget } from "@/app/initiativeQueueHud/InitiativeQueueInteraction";

function card(
  overrides: Partial<InitiativeQueueEntry>,
): InitiativeQueueEntry {
  return {
    cardId: "card",
    state: InitiativeQueueCardState.Identified,
    label: InitiativeQueueActorLabel.Enemy,
    unitId: "enemy",
    isCurrent: false,
    canHighlight: true,
    ...overrides,
  };
}

describe("getInitiativeQueueHighlightTarget", () => {
  it("allows a visible identified card to request its unit highlight", () => {
    expect(getInitiativeQueueHighlightTarget(card({}))).toBe("enemy");
  });

  it("does not expose an interaction target for an undiscovered Enemy card", () => {
    expect(getInitiativeQueueHighlightTarget(card({
      state: InitiativeQueueCardState.Unknown,
      label: undefined,
      unitId: undefined,
      canHighlight: false,
    }))).toBeUndefined();
  });

  it("does not expose an interaction target for a discovered but hidden card", () => {
    expect(getInitiativeQueueHighlightTarget(card({
      canHighlight: false,
    }))).toBeUndefined();
  });
});

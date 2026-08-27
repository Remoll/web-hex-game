import { describe, expect, it } from "vitest";
import {
  TacticalCursor,
  getTacticalCursor,
  getTacticalCursorStyle,
} from "@/app/inputController/TacticalCursor";
import {
  GameActionPreviewType,
  GameActionRejectionReason,
} from "@/game/gameSession/GameSession";

describe("getTacticalCursor", () => {
  it("maps semantic interaction previews to the four tactical cursor states", () => {
    expect(getTacticalCursor({
      type: GameActionPreviewType.Selection,
      unitId: "player",
    })).toBe(
      TacticalCursor.Select,
    );
    expect(
      getTacticalCursor(
        {
          type: GameActionPreviewType.ValidMove,
          unitId: "player",
          destination: { q: 1, r: 0 },
          path: { steps: [{ q: 1, r: 0 }], cost: 1 },
        },
      ),
    ).toBe(TacticalCursor.Move);
    expect(
      getTacticalCursor(
        {
          type: GameActionPreviewType.ValidAttack,
          attackerId: "player",
          targetId: "enemy",
        },
      ),
    ).toBe(TacticalCursor.Attack);
    expect(
      getTacticalCursor(
        {
          type: GameActionPreviewType.OutOfRange,
          reason: GameActionRejectionReason.OutOfRange,
        },
      ),
    ).toBe(TacticalCursor.Unavailable);
  });

  it("uses the unavailable cursor as the default for empty terrain", () => {
    expect(
      getTacticalCursor(
        {
          type: GameActionPreviewType.OutOfRange,
          reason: GameActionRejectionReason.OutOfRange,
        },
      ),
    ).toBe(TacticalCursor.Unavailable);
    expect(getTacticalCursor(undefined)).toBe(TacticalCursor.Unavailable);
    expect(getTacticalCursorStyle(TacticalCursor.Attack)).toContain(
      "/cursors/attack.png",
    );
    expect(getTacticalCursorStyle(TacticalCursor.Unavailable)).toContain(
      "/cursors/unavailable.png",
    );
  });
});

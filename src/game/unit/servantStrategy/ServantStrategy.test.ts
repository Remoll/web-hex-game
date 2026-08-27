import { describe, expect, it } from "vitest";
import {
  holdServantStrategy,
  pursueDesignatedEnemyStrategy,
  secureDesignatedHexStrategy,
  ServantStrategyType,
} from "@/game/unit/servantStrategy/ServantStrategy";

describe("ServantStrategy", () => {
  it("exposes the Hold strategy as a stable serialized value", () => {
    expect(holdServantStrategy).toEqual({
      type: ServantStrategyType.Hold,
    });
  });

  it("stores a designated Enemy identity without a target position", () => {
    expect(pursueDesignatedEnemyStrategy("enemy-1")).toEqual({
      type: ServantStrategyType.PursueDesignatedEnemy,
      targetEnemyId: "enemy-1",
    });
  });

  it("copies a designated tactical hex into the Secure strategy", () => {
    const targetHex = { q: 2, r: -1 };

    const strategy = secureDesignatedHexStrategy(targetHex);
    targetHex.q = 9;

    expect(strategy).toEqual({
      type: ServantStrategyType.SecureDesignatedHex,
      targetHex: { q: 2, r: -1 },
    });
  });
});

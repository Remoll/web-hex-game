import { describe, expect, it } from "vitest";
import {
  holdServantStrategy,
  protectMageServantStrategy,
  protectMageThreatRange,
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

  it("stores Protect Mage without a Mage position or presentation reference", () => {
    expect(protectMageThreatRange).toBe(2);
    expect(protectMageServantStrategy).toEqual({
      type: ServantStrategyType.ProtectMage,
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

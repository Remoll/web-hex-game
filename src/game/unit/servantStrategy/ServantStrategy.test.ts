import { describe, expect, it } from "vitest";
import {
  holdServantStrategy,
  pursueDesignatedEnemyStrategy,
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
});

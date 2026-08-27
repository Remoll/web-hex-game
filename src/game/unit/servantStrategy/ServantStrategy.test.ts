import { describe, expect, it } from "vitest";
import {
  holdServantStrategy,
  ServantStrategyType,
} from "@/game/unit/servantStrategy/ServantStrategy";

describe("ServantStrategy", () => {
  it("exposes the Hold strategy as a stable serialized value", () => {
    expect(holdServantStrategy).toEqual({
      type: ServantStrategyType.Hold,
    });
  });
});

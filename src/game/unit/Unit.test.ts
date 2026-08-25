import { describe, expect, it } from "vitest";
import { Unit, UnitTexture } from "@/game/unit/Unit";

describe("Unit", () => {
  it("is concrete and keeps its texture and position isolated from callers", () => {
    const initialPosition = { q: 1, r: -2 };
    const unit = new Unit("enemy-1", initialPosition, UnitTexture.EnemyIdle);
    initialPosition.q = 9;

    const exposedPosition = unit.position;
    exposedPosition.r = 9;

    expect(unit.id).toBe("enemy-1");
    expect(unit.texture).toBe(UnitTexture.EnemyIdle);
    expect(unit.position).toEqual({ q: 1, r: -2 });
  });
});

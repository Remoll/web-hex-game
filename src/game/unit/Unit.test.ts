import { describe, expect, it } from "vitest";
import { Faction } from "@/game/faction/Faction";
import { MovementType } from "@/game/types";
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

  it("spends movement incrementally and restores the temporary round budget", () => {
    const unit = new Unit("player", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      faction: Faction.Player,
      movementType: MovementType.Ground,
      movementRange: 3,
      maxHp: 100,
      currentHp: 100,
      attackPower: 20,
    });

    expect(unit.remainingMovement).toBe(3);
    expect(unit.remainingActions).toBe(1);

    unit.spendMovement(1);
    expect(unit.remainingMovement).toBe(2);
    expect(unit.remainingActions).toBe(1);
    expect(() => unit.spendMovement(3)).toThrow("cannot spend 3 movement");

    unit.exhaustRoundBudget();
    expect(unit.remainingMovement).toBe(0);
    expect(unit.remainingActions).toBe(0);

    unit.resetRoundBudget();
    expect(unit.remainingMovement).toBe(3);
    expect(unit.remainingActions).toBe(1);

    unit.receiveDamage(100);
    expect(unit.isAlive).toBe(false);
    expect(unit.currentHp).toBe(0);

    unit.resetRoundBudget();
    expect(unit.remainingMovement).toBe(0);
    expect(unit.remainingActions).toBe(0);
  });

  it("rejects invalid health configuration and damage", () => {
    expect(() => new Unit("invalid", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      maxHp: 100,
      currentHp: 101,
    })).toThrow("current HP between zero and maximum HP");

    const unit = new Unit("enemy", { q: 0, r: 0 }, UnitTexture.EnemyIdle);
    expect(() => unit.receiveDamage(-1)).toThrow("Damage must be a non-negative finite number");
  });
});

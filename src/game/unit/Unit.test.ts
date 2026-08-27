import { describe, expect, it } from "vitest";
import { Faction } from "@/game/faction/Faction";
import { MovementType } from "@/game/types";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
import {
  TacticalAttribute,
  defaultTacticalAttributes,
} from "@/game/unit/tacticalAttributes/TacticalAttributes";

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

  it("retains its tactical configuration and becomes defeated at zero HP", () => {
    const unit = new Unit("player", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      faction: Faction.Player,
      movementType: MovementType.Ground,
      movementRange: 3,
      attackPower: 20,
    });

    expect(unit.movementRange).toBe(3);
    expect(unit.attackPower).toBe(20);

    unit.receiveDamage(100);
    expect(unit.isAlive).toBe(false);
    expect(unit.currentHp).toBe(0);
  });

  it("rejects invalid health configuration and damage", () => {
    expect(() => new Unit("invalid", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      currentHp: 101,
    })).toThrow("current HP between zero and maximum HP");

    const unit = new Unit("enemy", { q: 0, r: 0 }, UnitTexture.EnemyIdle);
    expect(() => unit.receiveDamage(-1)).toThrow("Damage must be a non-negative finite number");
  });

  it("derives current combat statistics from validated tactical attributes", () => {
    const unit = new Unit("attributes", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      attributes: {
        [TacticalAttribute.Might]: 14,
        [TacticalAttribute.Finesse]: 14,
        [TacticalAttribute.Vitality]: 14,
        [TacticalAttribute.Insight]: 14,
      },
    });
    const mage = new Player("mage", { q: 1, r: 0 }, UnitTexture.PlayerIdle, {
      attributes: { [TacticalAttribute.Insight]: 14 },
    });

    expect(unit.attributes).toMatchObject({
      [TacticalAttribute.Might]: 14,
      [TacticalAttribute.Finesse]: 14,
      [TacticalAttribute.Vitality]: 14,
      [TacticalAttribute.Insight]: 14,
    });
    expect(unit.attackPower).toBe(24);
    expect(unit.maxHp).toBe(120);
    expect(unit.currentHp).toBe(120);
    expect(unit.tempo).toBe(102);
    expect(mage.viewRange).toBe(6);
  });

  it("keeps score-ten units at baseline and validates current HP against Vitality", () => {
    const baseline = new Unit(
      "baseline",
      { q: 0, r: 0 },
      UnitTexture.EnemyIdle,
      { attributes: defaultTacticalAttributes },
    );

    expect(baseline.attackPower).toBe(20);
    expect(baseline.maxHp).toBe(100);
    expect(baseline.currentHp).toBe(baseline.maxHp);
    expect(baseline.tempo).toBe(100);
    expect(() => new Unit("invalid-hp", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      attributes: { [TacticalAttribute.Vitality]: 0 },
      currentHp: 51,
    })).toThrow("Unit invalid-hp must have current HP between zero and maximum HP");

    const damagedUnit = new Unit("damaged", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      attributes: { [TacticalAttribute.Vitality]: 12 },
      currentHp: 55,
    });
    expect(damagedUnit).toMatchObject({ maxHp: 110, currentHp: 55 });
  });
});

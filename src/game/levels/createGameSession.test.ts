import { describe, expect, it } from "vitest";
import { Faction } from "@/game/faction/Faction";
import { createGameSession } from "@/game/levels/createGameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { MovementType, TerrainType } from "@/game/types";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
import { TacticalAttribute } from "@/game/unit/tacticalAttributes/TacticalAttributes";

const level: LevelDefinition = {
  map: [
    {
      q: 0,
      r: 0,
      fieldAttrs: {
        terrainType: TerrainType.Grass,
        allowedMovements: {
          [MovementType.Ground]: true,
          [MovementType.Flying]: true,
        },
        groundLevel: 0,
        leavingCostMultiplier: 1,
      },
    },
    {
      q: 2,
      r: 0,
      fieldAttrs: {
        terrainType: TerrainType.Grass,
        allowedMovements: {
          [MovementType.Ground]: true,
          [MovementType.Flying]: true,
        },
        groundLevel: 1,
        leavingCostMultiplier: 1,
      },
    },
  ],
  player: {
    id: "player",
    position: { q: 0, r: 0 },
    texture: UnitTexture.PlayerIdle,
    faction: Faction.Player,
    movementType: MovementType.Ground,
    movementRange: 3,
    attackPower: 20,
  },
  units: [
    {
      id: "enemy-1",
      position: { q: 2, r: 0 },
      texture: UnitTexture.EnemyIdle,
      faction: Faction.Enemy,
      movementType: MovementType.Ground,
      movementRange: 3,
      attackPower: 20,
    },
  ],
};

describe("createGameSession", () => {
  it("creates the player and regular units declared by a level", () => {
    const { session, player } = createGameSession(level);
    const enemy = session.getUnit("enemy-1");

    expect(player).toBeInstanceOf(Player);
    expect(player.texture).toBe(UnitTexture.PlayerIdle);
    expect(player.faction).toBe(Faction.Player);
    expect(session.units.map((unit) => unit.id)).toEqual(["player", "enemy-1"]);
    expect(enemy).toBeInstanceOf(Unit);
    expect(enemy).not.toBeInstanceOf(Player);
    expect(enemy?.position).toEqual({ q: 2, r: 0 });
    expect(enemy?.texture).toBe(UnitTexture.EnemyIdle);
    expect(enemy?.faction).toBe(Faction.Enemy);
    expect(enemy?.currentHp).toBe(enemy?.maxHp);
    expect(session.gameMap.getField(2, 0)?.getGroundLevel()).toBe(1);
  });

  it("rejects a level that assigns the player an unsupported faction", () => {
    const invalidPlayerLevel: LevelDefinition = {
      ...level,
      player: { ...level.player, faction: Faction.Enemy },
    };

    expect(() => createGameSession(invalidPlayerLevel)).toThrow(
      "The level player must use the player faction",
    );
  });

  it("resolves validated tactical attributes from level definitions", () => {
    const attributeLevel: LevelDefinition = {
      ...level,
      player: {
        ...level.player,
        attributes: { [TacticalAttribute.Insight]: 12 },
      },
      units: [{
        ...level.units[0],
        attributes: {
          [TacticalAttribute.Might]: 14,
          [TacticalAttribute.Finesse]: 14,
          [TacticalAttribute.Vitality]: 14,
        },
      }],
    };

    const { player, session } = createGameSession(attributeLevel);
    const enemy = session.getUnit("enemy-1");

    expect(player.viewRange).toBe(5);
    expect(enemy).toMatchObject({
      attackPower: 24,
      maxHp: 120,
      currentHp: 120,
      tempo: 102,
    });
  });

  it("rejects invalid tactical attribute values from a level definition", () => {
    const invalidAttributeLevel: LevelDefinition = {
      ...level,
      player: {
        ...level.player,
        attributes: { [TacticalAttribute.Finesse]: 10.5 },
      },
    };

    expect(() => createGameSession(invalidAttributeLevel)).toThrow(
      "Tactical attribute finesse must be a non-negative integer",
    );
  });
});

import { describe, expect, it } from "vitest";
import { createGameSession } from "@/game/levels/createGameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
import { MovementType, TerrainType } from "@/game/types";

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
  },
  units: [
    {
      id: "enemy-1",
      position: { q: 2, r: 0 },
      texture: UnitTexture.EnemyIdle,
    },
  ],
};

describe("createGameSession", () => {
  it("creates the player and regular units declared by a level", () => {
    const { session, player } = createGameSession(level);
    const enemy = session.getUnit("enemy-1");

    expect(player).toBeInstanceOf(Player);
    expect(player.texture).toBe(UnitTexture.PlayerIdle);
    expect(session.units.map((unit) => unit.id)).toEqual(["player", "enemy-1"]);
    expect(enemy).toBeInstanceOf(Unit);
    expect(enemy).not.toBeInstanceOf(Player);
    expect(enemy?.position).toEqual({ q: 2, r: 0 });
    expect(enemy?.texture).toBe(UnitTexture.EnemyIdle);
    expect(session.gameMap.getField(2, 0)?.getGroundLevel()).toBe(1);
  });
});

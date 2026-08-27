import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Faction } from "@/game/faction/Faction";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { MovementType, TerrainType } from "@/game/types";
import { UnitTacticalRole, UnitTexture } from "@/game/unit/Unit";
import { TacticalAttribute } from "@/game/unit/tacticalAttributes/TacticalAttributes";

const exampleLevelPath = fileURLToPath(
  new URL("../../../public/levels/example.json", import.meta.url),
);

function hexDistance(
  first: { q: number; r: number },
  second: { q: number; r: number },
): number {
  return Math.max(
    Math.abs(first.q - second.q),
    Math.abs(first.r - second.r),
    Math.abs(first.q + first.r - second.q - second.r),
  );
}

describe("example level", () => {
  it("preserves the original map layout and defines all four faction fixtures", async () => {
    const level = JSON.parse(
      await readFile(exampleLevelPath, "utf8"),
    ) as LevelDefinition;

    expect(level.player).toMatchObject({
      id: "player",
      position: { q: 0, r: 0 },
      texture: UnitTexture.PlayerIdle,
      faction: Faction.Player,
      movementType: MovementType.Ground,
      movementRange: 3,
      attackPower: 20,
      tacticalRole: UnitTacticalRole.Mage,
      viewRange: 4,
      attributes: {
        [TacticalAttribute.Might]: 12,
        [TacticalAttribute.Finesse]: 12,
        [TacticalAttribute.Vitality]: 12,
        [TacticalAttribute.Insight]: 12,
      },
    });
    expect(
      level.map
        .filter((cell) => hexDistance(cell, { q: 0, r: 0 }) <= 2)
        .map(({ q, r, fieldAttrs }) => ({
        q,
        r,
        terrainType: fieldAttrs.terrainType,
        groundLevel: fieldAttrs.groundLevel,
        })),
    ).toEqual([
      { q: 0, r: -2, terrainType: TerrainType.Grass, groundLevel: 3 },
      { q: 1, r: -2, terrainType: TerrainType.Grass, groundLevel: 2 },
      { q: 2, r: -2, terrainType: TerrainType.Grass, groundLevel: 2 },
      { q: -1, r: -1, terrainType: TerrainType.Grass, groundLevel: 4 },
      { q: 0, r: -1, terrainType: TerrainType.Water, groundLevel: 0 },
      { q: 1, r: -1, terrainType: TerrainType.Water, groundLevel: 0 },
      { q: 2, r: -1, terrainType: TerrainType.Grass, groundLevel: 1 },
      { q: -2, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: -1, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: 0, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: 1, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: 2, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: -2, r: 1, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: -1, r: 1, terrainType: TerrainType.Water, groundLevel: 0 },
      { q: 0, r: 1, terrainType: TerrainType.Grass, groundLevel: 2 },
      { q: 1, r: 1, terrainType: TerrainType.Grass, groundLevel: 1 },
      { q: -2, r: 2, terrainType: TerrainType.Grass, groundLevel: 1 },
      { q: -1, r: 2, terrainType: TerrainType.Grass, groundLevel: 1 },
      { q: 0, r: 2, terrainType: TerrainType.Grass, groundLevel: 1 },
    ]);
    expect(level.map).toHaveLength(127);
    expect(Math.max(
      ...level.map.map((cell) => hexDistance(cell, { q: 0, r: 0 })),
    )).toBe(6);
    expect(level.map.filter((field) => !field.fieldAttrs.allowedMovements.ground))
      .toHaveLength(3);
    for (const definition of [level.player, ...level.units]) {
      expect(definition).not.toHaveProperty("maxHp");
      expect(definition).not.toHaveProperty("currentHp");
    }
    expect(level.units).toHaveLength(3);
    expect(level.units[0]).toMatchObject({
      id: "friendly-1",
      position: { q: -1, r: 0 },
      texture: UnitTexture.PlayerIdle,
      faction: Faction.Player,
      movementType: MovementType.Ground,
      movementRange: 3,
      attackPower: 20,
      attributes: {
        [TacticalAttribute.Might]: 10,
        [TacticalAttribute.Finesse]: 11,
        [TacticalAttribute.Vitality]: 12,
        [TacticalAttribute.Insight]: 9,
      },
    });
    expect(level.units[1]).toMatchObject({
      id: "enemy-1",
      position: { q: 2, r: 0 },
      texture: UnitTexture.EnemyIdle,
      faction: Faction.Enemy,
      attributes: {
        [TacticalAttribute.Might]: 14,
        [TacticalAttribute.Finesse]: 9,
        [TacticalAttribute.Vitality]: 12,
        [TacticalAttribute.Insight]: 10,
      },
    });
    expect(level.units[2]).toMatchObject({
      id: "neutral-1",
      position: { q: 2, r: -2 },
      faction: Faction.Neutral,
      attributes: {
        [TacticalAttribute.Might]: 8,
        [TacticalAttribute.Finesse]: 10,
        [TacticalAttribute.Vitality]: 10,
        [TacticalAttribute.Insight]: 10,
      },
    });
    expect(hexDistance(level.player.position, level.units[1].position)).toBe(2);
    expect(hexDistance(level.player.position, level.units[2].position)).toBe(2);
  });
});

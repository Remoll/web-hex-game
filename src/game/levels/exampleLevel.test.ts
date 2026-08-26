import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Faction } from "@/game/faction/Faction";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { MovementType, TerrainType } from "@/game/types";
import { UnitTexture } from "@/game/unit/Unit";

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
      maxHp: 100,
      currentHp: 100,
      attackPower: 20,
    });
    expect(
      level.map.map(({ q, r, fieldAttrs }) => ({
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
    expect(level.map.filter((field) => !field.fieldAttrs.allowedMovements.ground))
      .toHaveLength(3);
    expect(level.units).toHaveLength(3);
    expect(level.units[0]).toMatchObject({
      id: "friendly-1",
      position: { q: -1, r: 0 },
      texture: UnitTexture.PlayerIdle,
      faction: Faction.Player,
      movementType: MovementType.Ground,
      movementRange: 3,
      maxHp: 100,
      currentHp: 100,
      attackPower: 20,
    });
    expect(level.units[1]).toMatchObject({
      id: "enemy-1",
      position: { q: 2, r: 0 },
      texture: UnitTexture.EnemyIdle,
      faction: Faction.Enemy,
    });
    expect(level.units[2]).toMatchObject({
      id: "neutral-1",
      position: { q: 2, r: -2 },
      faction: Faction.Neutral,
    });
    expect(hexDistance(level.player.position, level.units[1].position)).toBe(2);
    expect(hexDistance(level.player.position, level.units[2].position)).toBe(2);
  });
});

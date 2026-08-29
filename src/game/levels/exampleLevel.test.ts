import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
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
  it("preserves the existing map while expanding its tactical fixture", async () => {
    const level = JSON.parse(
      await readFile(exampleLevelPath, "utf8"),
    ) as LevelDefinition;

    expect(level.player).toMatchObject({
      id: "player",
      position: { q: -6, r: 0 },
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
    expect(level.map).toHaveLength(271);
    expect(Math.max(
      ...level.map.map((cell) => hexDistance(cell, { q: 0, r: 0 })),
    )).toBe(9);
    expect(
      Array.from({ length: 10 }, (_, radius) => level.map.filter(
        (cell) => hexDistance(cell, { q: 0, r: 0 }) === radius,
      ).length),
    ).toEqual([1, 6, 12, 18, 24, 30, 36, 42, 48, 54]);
    expect(level.map.filter(
      (cell) => hexDistance(cell, { q: 0, r: 0 }) <= 6,
    )).toHaveLength(127);
    expect(level.map.filter((field) => !field.fieldAttrs.allowedMovements.ground))
      .toHaveLength(11);
    expect(level.map.filter((field) => field.fieldAttrs.terrainType === TerrainType.Water
      && field.fieldAttrs.allowedMovements.ground)).toEqual([
      expect.objectContaining({ q: -7, r: 0 }),
      expect.objectContaining({ q: -7, r: 3 }),
    ]);
    expect(level.map.filter((field) => field.fieldAttrs.groundLevel === 1))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ q: -8, r: 1 }),
        expect.objectContaining({ q: -8, r: 4 }),
        expect.objectContaining({ q: 4, r: -8 }),
        expect.objectContaining({ q: 8, r: -6 }),
      ]));
    const gameMap = new GameMap(level.map);
    expect(gameMap.findShortestPath(
      level.player.position,
      { q: -8, r: 1 },
      MovementType.Ground,
      3,
    )).toEqual({
      cost: 3,
      steps: [{ q: -7, r: 0 }, { q: -8, r: 1 }],
    });
    for (const definition of [level.player, ...level.units]) {
      expect(definition).not.toHaveProperty("maxHp");
      expect(definition).not.toHaveProperty("currentHp");
    }
    expect(level.units).toHaveLength(9);
    expect(level.units.filter((unit) => unit.faction === Faction.Player))
      .toHaveLength(2);
    expect(level.units.filter((unit) => unit.faction === Faction.Enemy))
      .toHaveLength(7);
    expect(level.units.filter((unit) => unit.faction === Faction.Neutral))
      .toHaveLength(0);
    expect(level.units[0]).toMatchObject({
      id: "friendly-1",
      position: { q: -5, r: 0 },
      texture: UnitTexture.AllyIdle,
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
      id: "friendly-2",
      position: { q: -6, r: 1 },
      texture: UnitTexture.AllyIdle,
      faction: Faction.Player,
      attributes: {
        [TacticalAttribute.Might]: 9,
        [TacticalAttribute.Finesse]: 12,
        [TacticalAttribute.Vitality]: 11,
        [TacticalAttribute.Insight]: 11,
      },
    });
    expect(level.units.filter((unit) => unit.faction === Faction.Enemy)
      .map((unit) => ({ id: unit.id, position: unit.position }))).toEqual([
      { id: "enemy-1", position: { q: 2, r: 0 } },
      { id: "enemy-2", position: { q: 9, r: 0 } },
      { id: "enemy-3", position: { q: 6, r: -9 } },
      { id: "enemy-4", position: { q: 0, r: -9 } },
      { id: "enemy-5", position: { q: 3, r: 6 } },
      { id: "enemy-6", position: { q: -3, r: 9 } },
      { id: "enemy-7", position: { q: -9, r: 5 } },
    ]);
    const playerFactionServants = level.units.filter(
      (unit) => unit.faction === Faction.Player,
    );
    const occupiedPositionKeys = [level.player, ...level.units].map(
      (unit) => `${unit.position.q},${unit.position.r}`,
    );
    expect(new Set(occupiedPositionKeys).size).toBe(occupiedPositionKeys.length);
    expect(playerFactionServants.every((servant) =>
      hexDistance(level.player.position, servant.position) === 1
      && gameMap.getField(servant.position.q, servant.position.r)
        ?.getAllowedMovements()[MovementType.Ground],
    )).toBe(true);
  });
});

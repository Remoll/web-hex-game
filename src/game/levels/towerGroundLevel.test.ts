import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { createGameSession } from "@/game/levels/createGameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { MovementType, TerrainType } from "@/game/types";

const towerGroundLevelPath = fileURLToPath(
  new URL("../../../public/levels/tower-ground.json", import.meta.url),
);
const towerGroundMapRadius = 1;
const towerGroundFieldCount = 7;
const towerGroundEntryCoordinate = { q: 0, r: 0 };
const towerGroundLevel = 0;
const towerGroundLeavingCostMultiplier = 1;
const serializedCobblestoneTerrainType = "cobblestone";

async function loadTowerGroundLevel(): Promise<LevelDefinition> {
  return JSON.parse(await readFile(towerGroundLevelPath, "utf8")) as LevelDefinition;
}

describe("tower-ground level fixture", () => {
  it("declares a small, passable Cobblestone tactical floor with a valid entry", async () => {
    const level = await loadTowerGroundLevel();
    const gameMap = new GameMap(level.map);
    const { player } = createGameSession(level);
    const entryField = gameMap.getField(
      towerGroundEntryCoordinate.q,
      towerGroundEntryCoordinate.r,
    );

    expect(gameMap.radiusInHex).toBe(towerGroundMapRadius);
    expect(level.player.position).toEqual(towerGroundEntryCoordinate);
    expect(player.position).toEqual(towerGroundEntryCoordinate);
    expect(level.units).toEqual([]);
    expect(level.map).toHaveLength(towerGroundFieldCount);
    expect(TerrainType.Cobblestone).toBe(serializedCobblestoneTerrainType);
    expect(entryField?.getTerrainType()).toBe(TerrainType.Cobblestone);

    for (const field of level.map) {
      expect(field.fieldAttrs).toEqual({
        terrainType: TerrainType.Cobblestone,
        allowedMovements: {
          [MovementType.Ground]: true,
          [MovementType.Flying]: true,
        },
        groundLevel: towerGroundLevel,
        leavingCostMultiplier: towerGroundLeavingCostMultiplier,
      });
    }
  });
});

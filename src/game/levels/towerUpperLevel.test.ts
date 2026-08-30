import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { createGameSession } from "@/game/levels/createGameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { MovementType, TerrainType } from "@/game/types";
import {
  cobblestoneTerrainAtlasIndex,
  terrainTextureAtlasIndices,
} from "@/rendering/textures/TerrainAtlasMapping";

const towerUpperLevelPath = fileURLToPath(
  new URL("../../../public/levels/tower-upper.json", import.meta.url),
);
const towerUpperMapRadius = 1;
const towerUpperFieldCount = 7;
const towerUpperEntryCoordinate = { q: -1, r: 0 };
const towerUpperGroundLevel = 0;
const towerUpperLeavingCostMultiplier = 1;
const serializedCobblestoneTerrainType = "cobblestone";

async function loadTowerUpperLevel(): Promise<LevelDefinition> {
  return JSON.parse(await readFile(towerUpperLevelPath, "utf8")) as LevelDefinition;
}

describe("tower-upper level fixture", () => {
  it("declares a small, passable Cobblestone tactical floor with a valid stair entry", async () => {
    const level = await loadTowerUpperLevel();
    const gameMap = new GameMap(level.map);
    const { player } = createGameSession(level);
    const entryField = gameMap.getField(
      towerUpperEntryCoordinate.q,
      towerUpperEntryCoordinate.r,
    );

    expect(gameMap.radiusInHex).toBe(towerUpperMapRadius);
    expect(level.player.position).toEqual(towerUpperEntryCoordinate);
    expect(player.position).toEqual(towerUpperEntryCoordinate);
    expect(level.units).toEqual([]);
    expect(level.map).toHaveLength(towerUpperFieldCount);
    expect(TerrainType.Cobblestone).toBe(serializedCobblestoneTerrainType);
    expect(entryField?.getTerrainType()).toBe(TerrainType.Cobblestone);
    expect(terrainTextureAtlasIndices.get(TerrainType.Cobblestone)).toBe(
      cobblestoneTerrainAtlasIndex,
    );

    for (const field of level.map) {
      expect(field.fieldAttrs).toEqual({
        terrainType: TerrainType.Cobblestone,
        allowedMovements: {
          [MovementType.Ground]: true,
          [MovementType.Flying]: true,
        },
        groundLevel: towerUpperGroundLevel,
        leavingCostMultiplier: towerUpperLeavingCostMultiplier,
      });
    }
  });
});

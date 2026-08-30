import { describe, expect, it } from "vitest";
import { TerrainType } from "@/game/types";
import {
  cobblestoneTerrainAtlasIndex,
  terrainTextureAtlasIndices,
} from "@/rendering/textures/TerrainAtlasMapping";

describe("terrainTextureAtlasIndices", () => {
  it("maps passable Cobblestone to its dedicated existing atlas cell", () => {
    expect(terrainTextureAtlasIndices.get(TerrainType.Cobblestone)).toBe(
      cobblestoneTerrainAtlasIndex,
    );
  });
});

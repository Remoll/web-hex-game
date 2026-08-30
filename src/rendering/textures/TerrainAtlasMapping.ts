import { TerrainType } from "@/game/types";

const grassTerrainAtlasIndex = 0;
export const cobblestoneTerrainAtlasIndex = 33;
const shallowWaterTerrainAtlasIndex = 49;
const waterTerrainAtlasIndex = 42;

/** Renderer-only stable atlas-cell mapping for serialized terrain values. */
export const terrainTextureAtlasIndices: ReadonlyMap<TerrainType, number> = new Map([
  [TerrainType.Grass, grassTerrainAtlasIndex],
  [TerrainType.Cobblestone, cobblestoneTerrainAtlasIndex],
  [TerrainType.ShallowWater, shallowWaterTerrainAtlasIndex],
  [TerrainType.Water, waterTerrainAtlasIndex],
]);

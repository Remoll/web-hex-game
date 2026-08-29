import { TextureLoader } from "three";
import { TerrainType } from "@/game/types";
import { TextureAtlas } from "@/rendering/textures/textureAtlas/TextureAtlas";

const texture = new TextureLoader().load("/textures/terrain-atlas.png");
const shallowWaterTextureAtlasIndex = 49;

/** Renderer-only mapping from terrain domain values to atlas cells. */
export const terrainAtlas = new TextureAtlas<TerrainType>(
  texture,
  8,
  8,
  new Map([
    [TerrainType.Grass, 0],
    [TerrainType.ShallowWater, shallowWaterTextureAtlasIndex],
    [TerrainType.Water, 42],
  ]),
);

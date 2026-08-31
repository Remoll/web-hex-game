import { TextureLoader } from "three";
import { TextureAtlas } from "@/rendering/textures/textureAtlas/TextureAtlas";
import {
  edgeStructureAtlasColumnCount,
  edgeStructureAtlasRowCount,
  edgeStructureTextureAtlasIndices,
  propsAtlasColumnCount,
  propsAtlasRowCount,
  propsTextureAtlasIndices,
} from "@/rendering/tacticalStructureView/TacticalStructureAtlasMapping";
import {
  EdgeStructureSprite,
  PropsSprite,
} from "@/rendering/tacticalStructureView/TacticalStructureSprite";

const textureLoader = new TextureLoader();
const edgeStructureTexture = textureLoader.load("/textures/edge-structures-atlas.png");
const propsTexture = textureLoader.load("/textures/props-atlas.png");

/** Dedicated atlases keep structure materials independent from terrain and units. */
export const edgeStructureAtlas = new TextureAtlas<EdgeStructureSprite>(
  edgeStructureTexture,
  edgeStructureAtlasColumnCount,
  edgeStructureAtlasRowCount,
  edgeStructureTextureAtlasIndices,
);

export const propsAtlas = new TextureAtlas<PropsSprite>(
  propsTexture,
  propsAtlasColumnCount,
  propsAtlasRowCount,
  propsTextureAtlasIndices,
);

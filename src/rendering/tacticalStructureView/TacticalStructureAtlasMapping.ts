import { EdgeStructureSprite, PropsSprite } from "@/rendering/tacticalStructureView/TacticalStructureSprite";
import type { AtlasTextureRegion } from "@/rendering/customInstancedMesh/atlasInstancedMesh/AtlasInstancedMesh";

export const edgeStructureAtlasColumnCount = 4;
export const edgeStructureAtlasRowCount = 4;
export const propsAtlasColumnCount = 4;
export const propsAtlasRowCount = 4;

const stoneWallAtlasIndex = 0;
const timberWallAtlasIndex = 1;
const closedDoorAtlasIndex = 4;
const openDoorAtlasIndex = 5;
const windowAtlasIndex = 6;
const oakTreeAtlasIndex = 0;

/**
 * Uses dense central artwork only. Texture-space V grows bottom-to-top, while
 * atlas source pixels are measured top-to-bottom, hence the lower V offset.
 */
const stoneWallCoreTextureRegion: AtlasTextureRegion = {
  uOffset: 0.15,
  vOffset: 0.06,
  uScale: 0.77,
  vScale: 0.74,
};
const timberWallCoreTextureRegion: AtlasTextureRegion = {
  // The timber cell has a transparent band above its artwork. This tighter
  // central crop starts below that band so the side meets the top cap.
  uOffset: 0.14,
  vOffset: 0.075,
  uScale: 0.72,
  vScale: 0.7,
};

/** Physical cells in edge-structures-atlas.png, kept separate from gameplay. */
export const edgeStructureTextureAtlasIndices = new Map<EdgeStructureSprite, number>([
  [EdgeStructureSprite.StoneWall, stoneWallAtlasIndex],
  [EdgeStructureSprite.TimberWall, timberWallAtlasIndex],
  [EdgeStructureSprite.ClosedDoor, closedDoorAtlasIndex],
  [EdgeStructureSprite.OpenDoor, openDoorAtlasIndex],
  [EdgeStructureSprite.Window, windowAtlasIndex],
]);

/** Wall-only artwork regions; door, window, and tree cards use full tiles. */
export const wallTextureAtlasRegions = new Map<EdgeStructureSprite, AtlasTextureRegion>([
  [EdgeStructureSprite.StoneWall, stoneWallCoreTextureRegion],
  [EdgeStructureSprite.TimberWall, timberWallCoreTextureRegion],
]);

/** Physical cells in props-atlas.png, kept separate from authored Tree data. */
export const propsTextureAtlasIndices = new Map<PropsSprite, number>([
  [PropsSprite.OakTree, oakTreeAtlasIndex],
]);

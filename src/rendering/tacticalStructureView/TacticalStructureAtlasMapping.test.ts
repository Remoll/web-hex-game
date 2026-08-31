import { describe, expect, it } from "vitest";
import {
  edgeStructureAtlasColumnCount,
  edgeStructureAtlasRowCount,
  edgeStructureTextureAtlasIndices,
  propsAtlasColumnCount,
  propsAtlasRowCount,
  propsTextureAtlasIndices,
  wallTextureAtlasRegions,
} from "@/rendering/tacticalStructureView/TacticalStructureAtlasMapping";
import {
  EdgeStructureSprite,
  PropsSprite,
} from "@/rendering/tacticalStructureView/TacticalStructureSprite";

describe("tactical structure atlas mappings", () => {
  it("keeps every supplied edge-structure sprite in an explicit 4 by 4 atlas cell", () => {
    expect(edgeStructureAtlasColumnCount).toBe(4);
    expect(edgeStructureAtlasRowCount).toBe(4);
    expect(edgeStructureTextureAtlasIndices).toEqual(new Map([
      [EdgeStructureSprite.StoneWall, 0],
      [EdgeStructureSprite.TimberWall, 1],
      [EdgeStructureSprite.ClosedDoor, 4],
      [EdgeStructureSprite.OpenDoor, 5],
      [EdgeStructureSprite.Window, 6],
    ]));
  });

  it("maps the tree prop independently from edge-structure artwork", () => {
    expect(propsAtlasColumnCount).toBe(4);
    expect(propsAtlasRowCount).toBe(4);
    expect(propsTextureAtlasIndices).toEqual(new Map([
      [PropsSprite.OakTree, 0],
    ]));
  });

  it("crops only wall artwork to fill tall hex sides without a dark backfill", () => {
    expect(wallTextureAtlasRegions).toEqual(new Map([
      [EdgeStructureSprite.StoneWall, {
        uOffset: 0.15,
        vOffset: 0.06,
        uScale: 0.77,
        vScale: 0.74,
      }],
      [EdgeStructureSprite.TimberWall, {
        uOffset: 0.14,
        vOffset: 0.075,
        uScale: 0.72,
        vScale: 0.7,
      }],
    ]));
  });
});

import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { MovementType, TerrainType, type MapArray } from "@/game/types";
import {
  buildMapRenderModel,
  getHexForInstance,
} from "@/rendering/mapView/MapRenderModel";
import { defaultRenderConfig } from "@/rendering/RenderConfig";

const mapData: MapArray = [
  {
    q: 0,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 2,
      leavingCostMultiplier: 1,
    },
  },
  {
    q: -1,
    r: 1,
    fieldAttrs: {
      terrainType: TerrainType.Water,
      allowedMovements: { [MovementType.Ground]: false, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
];

describe("MapRenderModel", () => {
  it("builds terrain height, plane position, and stable instance mappings", () => {
    const model = buildMapRenderModel(
      new GameMap(mapData),
      defaultRenderConfig,
    );

    expect(model.cells).toHaveLength(2);
    expect(model.cells[0]).toMatchObject({
      instanceId: 0,
      coord: { q: 0, r: 0 },
      x: 0,
      y: 0,
      height: 48,
      fogPrismHeight: 48.05,
      terrainType: TerrainType.Grass,
    });
    expect(getHexForInstance(model, 1)).toEqual({ q: -1, r: 1 });
    expect(getHexForInstance(model, 2)).toBeUndefined();
  });
});

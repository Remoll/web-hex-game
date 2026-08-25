import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { MovementType, TerrainType, type MapArray } from "@/game/types";

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
    q: -2,
    r: 3,
    fieldAttrs: {
      terrainType: TerrainType.Water,
      allowedMovements: { [MovementType.Ground]: false, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
];

describe("GameMap", () => {
  it("retrieves fields and returns undefined for coordinates outside the map", () => {
    const map = new GameMap(mapData);

    expect(map.getField(0, 0)?.getGroundLevel()).toBe(2);
    expect(map.getField(9, 9)).toBeUndefined();
  });

  it("iterates in map-data order and calculates the axial radius", () => {
    const map = new GameMap(mapData);
    const coordinates: string[] = [];

    map.forEachField((q, r) => coordinates.push(`${q},${r}`));

    expect(coordinates).toEqual(["0,0", "-2,3"]);
    expect(map.radiusInHex).toBe(3);
  });
});

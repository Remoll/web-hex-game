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

  it("rejects duplicate field coordinates", () => {
    expect(() => new GameMap([mapData[0], mapData[0]])).toThrow(
      "The map contains duplicate field coordinates at 0,0",
    );
  });

  it("finds passable shortest paths and excludes occupied or impassable hexes", () => {
    const pathMap = new GameMap([
      {
        q: 0,
        r: 0,
        fieldAttrs: {
          terrainType: TerrainType.Grass,
          allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
          groundLevel: 0,
          leavingCostMultiplier: 99,
        },
      },
      {
        q: 1,
        r: 0,
        fieldAttrs: {
          terrainType: TerrainType.Water,
          allowedMovements: { [MovementType.Ground]: false, [MovementType.Flying]: true },
          groundLevel: 0,
          leavingCostMultiplier: 1,
        },
      },
      {
        q: 0,
        r: 1,
        fieldAttrs: {
          terrainType: TerrainType.Grass,
          allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
          groundLevel: 10,
          leavingCostMultiplier: 50,
        },
      },
      {
        q: 1,
        r: 1,
        fieldAttrs: {
          terrainType: TerrainType.Grass,
          allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
          groundLevel: 0,
          leavingCostMultiplier: 1,
        },
      },
    ]);

    expect(pathMap.getHexDistance({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(2);
    expect(pathMap.getNeighbours({ q: 0, r: 0 })).toEqual(
      expect.arrayContaining([{ q: 1, r: 0 }, { q: 0, r: 1 }]),
    );
    expect(
      pathMap.findShortestPath(
        { q: 0, r: 0 },
        { q: 1, r: 1 },
        MovementType.Ground,
        3,
      ),
    ).toEqual({
      cost: 2,
      steps: [{ q: 0, r: 1 }, { q: 1, r: 1 }],
    });
    expect(
      pathMap.findShortestPath(
        { q: 0, r: 0 },
        { q: 1, r: 1 },
        MovementType.Ground,
        3,
        (coord) => coord.q === 0 && coord.r === 1,
      ),
    ).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  baseMovementActionPointCost,
  groundUphillAdditionalActionPointCost,
  groundUphillMovementActionPointCost,
  shallowWaterLeavingCostMultiplier,
  singleGroundUphillElevationDifference,
} from "@/game/movement/GroundMovementRules";
import { MovementType, TerrainType, type MapArray } from "@/game/types";

const standardLeavingCostMultiplier = 1;
const shallowWaterBaseTraversalCost = baseMovementActionPointCost
  * shallowWaterLeavingCostMultiplier;
const shallowWaterUphillTraversalCost = shallowWaterBaseTraversalCost
  + groundUphillAdditionalActionPointCost;

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
          leavingCostMultiplier: standardLeavingCostMultiplier,
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
          groundLevel: 0,
          leavingCostMultiplier: standardLeavingCostMultiplier,
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

  it("finds a shortest path to any eligible destination without per-node paths", () => {
    const pathMap = new GameMap([
      {
        q: 0,
        r: 0,
        fieldAttrs: mapData[0].fieldAttrs,
      },
      {
        q: 1,
        r: 0,
        fieldAttrs: mapData[0].fieldAttrs,
      },
      {
        q: 2,
        r: 0,
        fieldAttrs: mapData[0].fieldAttrs,
      },
      {
        q: 0,
        r: 1,
        fieldAttrs: mapData[0].fieldAttrs,
      },
      {
        q: 1,
        r: 1,
        fieldAttrs: mapData[0].fieldAttrs,
      },
    ]);

    expect(pathMap.findShortestPathToAny(
      { q: 0, r: 0 },
      MovementType.Ground,
      (coord) => (coord.q === 2 && coord.r === 0)
        || (coord.q === 1 && coord.r === 1),
    )).toEqual({
      cost: 2,
      steps: [{ q: 1, r: 0 }, { q: 2, r: 0 }],
    });
    expect(pathMap.findShortestPathToAny(
      { q: 0, r: 0 },
      MovementType.Ground,
      (coord) => coord.q === 2 && coord.r === 0,
      (coord) => (coord.q === 1 && coord.r === 0)
        || (coord.q === 1 && coord.r === 1),
    )).toBeUndefined();
  });

  it("applies the shared Ground elevation edge rules and preserves Flying traversal", () => {
    const elevationMap = new GameMap([
      mapItem(0, 0, 0),
      mapItem(1, 0, 0),
      mapItem(2, 0, 1),
      mapItem(3, 0, 2),
      mapItem(0, 1, 2),
    ]);

    expect(elevationMap.getTraversalCost(
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      MovementType.Ground,
    )).toBe(baseMovementActionPointCost);
    expect(elevationMap.getTraversalCost(
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      MovementType.Ground,
    )).toBe(groundUphillMovementActionPointCost);
    expect(elevationMap.getTraversalCost(
      { q: 2, r: 0 },
      { q: 1, r: 0 },
      MovementType.Ground,
    )).toBe(baseMovementActionPointCost);
    expect(elevationMap.getTraversalCost(
      { q: 0, r: 0 },
      { q: 0, r: 1 },
      MovementType.Ground,
    )).toBeUndefined();
    expect(elevationMap.getTraversalCost(
      { q: 0, r: 1 },
      { q: 0, r: 0 },
      MovementType.Ground,
    )).toBeUndefined();
    expect(elevationMap.getTraversalCost(
      { q: 2, r: 0 },
      { q: 3, r: 0 },
      MovementType.Flying,
    )).toBe(baseMovementActionPointCost);
  });

  it("applies Shallow Water outgoing Ground costs while keeping deep Water blocked", () => {
    const shallowWaterGroundLevel = 1;
    const oneLevelLowerGroundLevel = shallowWaterGroundLevel
      - singleGroundUphillElevationDifference;
    const oneLevelHigherGroundLevel = shallowWaterGroundLevel
      + singleGroundUphillElevationDifference;
    const shallowWaterOrigin = { q: 0, r: 0 };
    const sameLevelDestination = { q: 1, r: 0 };
    const downhillDestination = { q: 0, r: 1 };
    const uphillDestination = { q: -1, r: 1 };
    const deepWaterDestination = { q: -1, r: 0 };
    const shallowWaterMap = new GameMap([
      mapItem(0, 0, shallowWaterGroundLevel, {
        terrainType: TerrainType.ShallowWater,
        permitsGroundMovement: true,
        leavingCostMultiplier: shallowWaterLeavingCostMultiplier,
      }),
      mapItem(1, 0, shallowWaterGroundLevel),
      mapItem(0, 1, oneLevelLowerGroundLevel),
      mapItem(-1, 1, oneLevelHigherGroundLevel),
      mapItem(-1, 0, shallowWaterGroundLevel, {
        terrainType: TerrainType.Water,
        permitsGroundMovement: false,
      }),
    ]);

    expect(TerrainType.ShallowWater).toBe("shallow-water");
    expect(shallowWaterMap.getTraversalCost(
      shallowWaterOrigin,
      sameLevelDestination,
      MovementType.Ground,
    )).toBe(shallowWaterBaseTraversalCost);
    expect(shallowWaterMap.getTraversalCost(
      shallowWaterOrigin,
      downhillDestination,
      MovementType.Ground,
    )).toBe(shallowWaterBaseTraversalCost);
    expect(shallowWaterMap.getTraversalCost(
      shallowWaterOrigin,
      uphillDestination,
      MovementType.Ground,
    )).toBe(shallowWaterUphillTraversalCost);
    expect(shallowWaterMap.findShortestPath(
      shallowWaterOrigin,
      uphillDestination,
      MovementType.Ground,
      shallowWaterBaseTraversalCost,
    )).toBeUndefined();
    expect(shallowWaterMap.getTraversalCost(
      shallowWaterOrigin,
      deepWaterDestination,
      MovementType.Ground,
    )).toBeUndefined();
    expect(shallowWaterMap.getTraversalCost(
      shallowWaterOrigin,
      deepWaterDestination,
      MovementType.Flying,
    )).toBe(baseMovementActionPointCost);
  });

  it("chooses the lower-AP route and rejects paths over the available budget", () => {
    const elevationMap = new GameMap([
      mapItem(0, 0, 0),
      mapItem(1, 0, 1),
      mapItem(0, 1, 0),
      mapItem(1, 1, 0),
    ]);

    expect(elevationMap.findShortestPath(
      { q: 0, r: 0 },
      { q: 1, r: 1 },
      MovementType.Ground,
      groundUphillMovementActionPointCost,
    )).toEqual({
      cost: baseMovementActionPointCost + baseMovementActionPointCost,
      steps: [{ q: 0, r: 1 }, { q: 1, r: 1 }],
    });
    expect(elevationMap.getReachablePaths(
      { q: 0, r: 0 },
      MovementType.Ground,
      groundUphillMovementActionPointCost - baseMovementActionPointCost,
    ).has("1,1")).toBe(false);
  });
});

interface MapItemOptions {
  readonly terrainType?: TerrainType;
  readonly permitsGroundMovement?: boolean;
  readonly leavingCostMultiplier?: number;
}

function mapItem(
  q: number,
  r: number,
  groundLevel: number,
  options: MapItemOptions = {},
) {
  return {
    q,
    r,
    fieldAttrs: {
      terrainType: options.terrainType ?? TerrainType.Grass,
      allowedMovements: {
        [MovementType.Ground]: options.permitsGroundMovement ?? true,
        [MovementType.Flying]: true,
      },
      groundLevel,
      leavingCostMultiplier: options.leavingCostMultiplier
        ?? standardLeavingCostMultiplier,
    },
  };
}

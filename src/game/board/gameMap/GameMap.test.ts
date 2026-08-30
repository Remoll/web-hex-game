import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  DoorBlockInitialState,
  TacticalHexAxis,
  TacticalHexStructureType,
  WallBlockSideMaterial,
  WallBlockTopCapPresentation,
  type TacticalHexStructurePlacementDefinition,
} from "@/game/board/structure/TacticalHexStructure";
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
const wallStructureId = "wall-0-0";
const doorStructureId = "door-1-0";
const treeStructureId = "tree-1-0";
const missingFieldStructureId = "missing-field";
const unknownStructureId = "unknown-structure";
const duplicateStructureCoordinate = { q: 0, r: 0 };
const missingStructureCoordinate = { q: 9, r: 9 };

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

  it("indexes immutable structure projections by coordinate and stable placement id", () => {
    const structureMap = new GameMap([
      mapItem(0, 0, 0),
      mapItem(1, 0, 0),
    ], [
      {
        id: wallStructureId,
        q: 0,
        r: 0,
        structure: {
          type: TacticalHexStructureType.WallBlock,
          sideMaterial: WallBlockSideMaterial.Stone,
        },
      },
      {
        id: doorStructureId,
        q: 1,
        r: 0,
        structure: {
          type: TacticalHexStructureType.DoorBlock,
          axis: TacticalHexAxis.R,
          initialState: DoorBlockInitialState.Closed,
        },
      },
    ]);

    const wallPlacement = structureMap.getStructurePlacementById(wallStructureId);
    expect(structureMap.structureCount).toBe(2);
    expect(structureMap.getStructure(0, 0)).toBe(wallPlacement?.structure);
    expect(wallPlacement).toEqual({
      id: wallStructureId,
      coordinate: { q: 0, r: 0 },
      structure: {
        type: TacticalHexStructureType.WallBlock,
        sideMaterial: WallBlockSideMaterial.Stone,
        topCapPresentation: WallBlockTopCapPresentation.Dark,
      },
    });
    expect(Object.isFrozen(wallPlacement)).toBe(true);
    expect(Object.isFrozen(wallPlacement?.coordinate)).toBe(true);
    expect(Object.isFrozen(wallPlacement?.structure)).toBe(true);

    const registeredPlacementIds: string[] = [];
    structureMap.forEachStructure((placement) => registeredPlacementIds.push(placement.id));
    expect(registeredPlacementIds).toEqual([wallStructureId, doorStructureId]);
    expect(structureMap.getStructurePlacement(9, 9)).toBeUndefined();
    expect(structureMap.getStructurePlacementById(unknownStructureId)).toBeUndefined();

    expect(structureMap.getTraversalCost(
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      MovementType.Ground,
    )).toBe(baseMovementActionPointCost);
  });

  it("rejects duplicate and off-map structure placements predictably", () => {
    const twoFieldMap = [mapItem(0, 0, 0), mapItem(1, 0, 0)];
    const wallPlacement: TacticalHexStructurePlacementDefinition = {
      id: wallStructureId,
      ...duplicateStructureCoordinate,
      structure: {
        type: TacticalHexStructureType.WallBlock,
        sideMaterial: WallBlockSideMaterial.Timber,
      },
    };

    expect(() => new GameMap(twoFieldMap, [
      wallPlacement,
      {
        id: treeStructureId,
        ...duplicateStructureCoordinate,
        structure: { type: TacticalHexStructureType.Tree },
      },
    ])).toThrow("The map contains duplicate tactical structures at 0,0");
    expect(() => new GameMap(twoFieldMap, [
      wallPlacement,
      {
        id: wallStructureId,
        q: 1,
        r: 0,
        structure: { type: TacticalHexStructureType.Tree },
      },
    ])).toThrow(`The map contains duplicate tactical structure id ${wallStructureId}`);
    expect(() => new GameMap(twoFieldMap, [{
      id: missingFieldStructureId,
      ...missingStructureCoordinate,
      structure: { type: TacticalHexStructureType.Tree },
    }])).toThrow("Tactical structure at 9,9 must reference an existing map field");
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

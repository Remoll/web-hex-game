import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getHexCoordKey } from "@/game/board/hexCoord/HexCoord";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { Faction } from "@/game/faction/Faction";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import {
  baseMovementActionPointCost,
  groundUphillAdditionalActionPointCost,
  shallowWaterLeavingCostMultiplier,
} from "@/game/movement/GroundMovementRules";
import {
  type FieldAttrs,
  type HexCoord,
  MovementType,
  TerrainType,
} from "@/game/types";
import { UnitTacticalRole, UnitTexture } from "@/game/unit/Unit";
import { TacticalAttribute } from "@/game/unit/tacticalAttributes/TacticalAttributes";

const exampleLevelPath = fileURLToPath(
  new URL("../../../public/levels/example.json", import.meta.url),
);

const expectedExampleMapFieldCount = 271;
const expectedExampleMapRadius = 9;
const radiusSixMapFieldCount = 127;
const firstMapRadius = 0;
const lastMapRadius = expectedExampleMapRadius;
const shallowWaterGroundLevel = 0;
const grassHillGroundLevel = 1;
const centralGrassHillGroundLevel = 2;
const shallowWaterRouteActionPointCost = baseMovementActionPointCost
  + baseMovementActionPointCost * shallowWaterLeavingCostMultiplier;
const shallowWaterUphillRouteActionPointCost = shallowWaterRouteActionPointCost
  + groundUphillAdditionalActionPointCost;
const insufficientShallowWaterRouteActionPointBudget = baseMovementActionPointCost
  * shallowWaterLeavingCostMultiplier;

const passableMovementTypes = {
  [MovementType.Ground]: true,
  [MovementType.Flying]: true,
} as const;

const shallowWaterFieldAttrs: FieldAttrs = {
  terrainType: TerrainType.ShallowWater,
  allowedMovements: passableMovementTypes,
  groundLevel: shallowWaterGroundLevel,
  leavingCostMultiplier: shallowWaterLeavingCostMultiplier,
};

const deepWaterFieldAttrs: FieldAttrs = {
  terrainType: TerrainType.Water,
  allowedMovements: {
    [MovementType.Ground]: false,
    [MovementType.Flying]: true,
  },
  groundLevel: shallowWaterGroundLevel,
  leavingCostMultiplier: baseMovementActionPointCost,
};

const shallowWaterCoordinates: readonly HexCoord[] = [
  { q: -8, r: 0 },
  { q: -7, r: 0 },
  { q: -7, r: 3 },
  { q: -7, r: 6 },
  { q: -4, r: 4 },
  { q: 1, r: -7 },
  { q: 1, r: 4 },
  { q: 6, r: -7 },
];

const existingDeepWaterCoordinates: readonly HexCoord[] = [
  { q: -9, r: 0 },
  { q: -9, r: 3 },
  { q: -8, r: 3 },
  { q: -7, r: -2 },
  { q: -7, r: -1 },
  { q: -7, r: 1 },
  { q: -7, r: 2 },
  { q: -1, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

const addedDeepWaterCoordinates: readonly HexCoord[] = [
  { q: -9, r: 4 },
  { q: -8, r: 4 },
  { q: -7, r: 4 },
  { q: -7, r: 5 },
  { q: -7, r: 7 },
  { q: -7, r: 8 },
  { q: -7, r: 9 },
  { q: -6, r: 4 },
  { q: -5, r: 4 },
  { q: -3, r: 4 },
  { q: -2, r: -7 },
  { q: -2, r: 4 },
  { q: -1, r: -7 },
  { q: -1, r: 4 },
  { q: 0, r: -7 },
  { q: 0, r: 4 },
  { q: 2, r: -7 },
  { q: 2, r: 4 },
  { q: 3, r: -7 },
  { q: 3, r: 4 },
  { q: 4, r: -7 },
  { q: 4, r: 4 },
  { q: 5, r: -7 },
  { q: 5, r: 4 },
  { q: 7, r: -7 },
  { q: 8, r: -7 },
  { q: 9, r: -7 },
];

const grassHillFields: readonly {
  readonly coordinate: HexCoord;
  readonly groundLevel: number;
}[] = [
  { coordinate: { q: 3, r: -4 }, groundLevel: grassHillGroundLevel },
  { coordinate: { q: 3, r: -3 }, groundLevel: grassHillGroundLevel },
  { coordinate: { q: 4, r: -5 }, groundLevel: grassHillGroundLevel },
  { coordinate: { q: 4, r: -4 }, groundLevel: centralGrassHillGroundLevel },
  { coordinate: { q: 4, r: -3 }, groundLevel: grassHillGroundLevel },
  { coordinate: { q: 5, r: -5 }, groundLevel: grassHillGroundLevel },
  { coordinate: { q: 5, r: -4 }, groundLevel: grassHillGroundLevel },
];

function hexDistance(
  first: { q: number; r: number },
  second: { q: number; r: number },
): number {
  return Math.max(
    Math.abs(first.q - second.q),
    Math.abs(first.r - second.r),
    Math.abs(first.q + first.r - second.q - second.r),
  );
}

function getFixtureField(
  level: LevelDefinition,
  coordinate: HexCoord,
): { readonly q: number; readonly r: number; readonly fieldAttrs: FieldAttrs } {
  const field = level.map.find(({ q, r }) => q === coordinate.q && r === coordinate.r);
  if (!field) {
    throw new Error(`The example fixture has no field at ${coordinate.q},${coordinate.r}`);
  }

  return field;
}

function sortCoordinates(coordinates: readonly HexCoord[]): HexCoord[] {
  return [...coordinates].sort((first, second) => first.q - second.q || first.r - second.r);
}

function getGroundConnectedCoordinates(
  gameMap: GameMap,
  origin: HexCoord,
): ReadonlySet<string> {
  const reachableCoordinateKeys = new Set<string>([getHexCoordKey(origin)]);
  const pendingCoordinates: HexCoord[] = [{ ...origin }];
  let nextPendingCoordinateIndex = 0;

  while (nextPendingCoordinateIndex < pendingCoordinates.length) {
    const currentCoordinate = pendingCoordinates[nextPendingCoordinateIndex];
    nextPendingCoordinateIndex += 1;

    for (const neighbour of gameMap.getNeighbours(currentCoordinate)) {
      const neighbourKey = getHexCoordKey(neighbour);
      if (reachableCoordinateKeys.has(neighbourKey)
        || gameMap.getTraversalCost(
          currentCoordinate,
          neighbour,
          MovementType.Ground,
        ) === undefined) {
        continue;
      }

      reachableCoordinateKeys.add(neighbourKey);
      pendingCoordinates.push(neighbour);
    }
  }

  return reachableCoordinateKeys;
}

describe("example level", () => {
  it("preserves the existing map while expanding its tactical fixture", async () => {
    const level = JSON.parse(
      await readFile(exampleLevelPath, "utf8"),
    ) as LevelDefinition;

    expect(level.player).toMatchObject({
      id: "player",
      position: { q: -6, r: 0 },
      texture: UnitTexture.PlayerIdle,
      faction: Faction.Player,
      movementType: MovementType.Ground,
      movementRange: 3,
      attackPower: 20,
      tacticalRole: UnitTacticalRole.Mage,
      viewRange: 4,
      attributes: {
        [TacticalAttribute.Might]: 12,
        [TacticalAttribute.Finesse]: 12,
        [TacticalAttribute.Vitality]: 12,
        [TacticalAttribute.Insight]: 12,
      },
    });
    expect(
      level.map
        .filter((cell) => hexDistance(cell, { q: 0, r: 0 }) <= 2)
        .map(({ q, r, fieldAttrs }) => ({
        q,
        r,
        terrainType: fieldAttrs.terrainType,
        groundLevel: fieldAttrs.groundLevel,
        })),
    ).toEqual([
      { q: 0, r: -2, terrainType: TerrainType.Grass, groundLevel: 3 },
      { q: 1, r: -2, terrainType: TerrainType.Grass, groundLevel: 2 },
      { q: 2, r: -2, terrainType: TerrainType.Grass, groundLevel: 2 },
      { q: -1, r: -1, terrainType: TerrainType.Grass, groundLevel: 4 },
      { q: 0, r: -1, terrainType: TerrainType.Water, groundLevel: 0 },
      { q: 1, r: -1, terrainType: TerrainType.Water, groundLevel: 0 },
      { q: 2, r: -1, terrainType: TerrainType.Grass, groundLevel: 1 },
      { q: -2, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: -1, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: 0, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: 1, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: 2, r: 0, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: -2, r: 1, terrainType: TerrainType.Grass, groundLevel: 0 },
      { q: -1, r: 1, terrainType: TerrainType.Water, groundLevel: 0 },
      { q: 0, r: 1, terrainType: TerrainType.Grass, groundLevel: 2 },
      { q: 1, r: 1, terrainType: TerrainType.Grass, groundLevel: 1 },
      { q: -2, r: 2, terrainType: TerrainType.Grass, groundLevel: 1 },
      { q: -1, r: 2, terrainType: TerrainType.Grass, groundLevel: 1 },
      { q: 0, r: 2, terrainType: TerrainType.Grass, groundLevel: 1 },
    ]);
    expect(level.map).toHaveLength(expectedExampleMapFieldCount);
    expect(Math.max(
      ...level.map.map((cell) => hexDistance(cell, { q: 0, r: 0 })),
    )).toBe(expectedExampleMapRadius);
    expect(
      Array.from({ length: lastMapRadius - firstMapRadius + 1 }, (_, radius) => level.map.filter(
        (cell) => hexDistance(cell, { q: 0, r: 0 }) === radius,
      ).length),
    ).toEqual([1, 6, 12, 18, 24, 30, 36, 42, 48, 54]);
    expect(level.map.filter(
      (cell) => hexDistance(cell, { q: 0, r: 0 }) <= 6,
    )).toHaveLength(radiusSixMapFieldCount);

    const deepWaterFields = level.map.filter(
      (field) => field.fieldAttrs.terrainType === TerrainType.Water,
    );
    const expectedDeepWaterCoordinates = [
      ...existingDeepWaterCoordinates,
      ...addedDeepWaterCoordinates,
    ];
    expect(sortCoordinates(deepWaterFields.map(({ q, r }) => ({ q, r })))).toEqual(
      sortCoordinates(expectedDeepWaterCoordinates),
    );
    expect(deepWaterFields.map((field) => field.fieldAttrs)).toEqual(
      expectedDeepWaterCoordinates.map(() => deepWaterFieldAttrs),
    );
    expect(deepWaterFields.every(
      (field) => !field.fieldAttrs.allowedMovements[MovementType.Ground],
    )).toBe(true);

    const shallowWaterFields = level.map.filter(
      (field) => field.fieldAttrs.terrainType === TerrainType.ShallowWater,
    );
    expect(sortCoordinates(shallowWaterFields.map(({ q, r }) => ({ q, r })))).toEqual(
      sortCoordinates(shallowWaterCoordinates),
    );
    expect(shallowWaterCoordinates.map(
      (coordinate) => getFixtureField(level, coordinate).fieldAttrs,
    )).toEqual(shallowWaterCoordinates.map(() => shallowWaterFieldAttrs));

    expect(grassHillFields.map(({ coordinate, groundLevel }) => ({
      coordinate,
      fieldAttrs: getFixtureField(level, coordinate).fieldAttrs,
      groundLevel,
    }))).toEqual(grassHillFields.map(({ coordinate, groundLevel }) => ({
      coordinate,
      fieldAttrs: {
        terrainType: TerrainType.Grass,
        allowedMovements: passableMovementTypes,
        groundLevel,
        leavingCostMultiplier: baseMovementActionPointCost,
      },
      groundLevel,
    })));

    const gameMap = new GameMap(level.map);
    const groundTraversableCoordinateKeys = new Set(level.map
      .filter((field) => field.fieldAttrs.allowedMovements[MovementType.Ground])
      .map(getHexCoordKey));
    expect(getGroundConnectedCoordinates(gameMap, level.player.position)).toEqual(
      groundTraversableCoordinateKeys,
    );

    const shallowWaterCrossingRoutes: readonly {
      readonly origin: HexCoord;
      readonly destination: HexCoord;
      readonly expectedSteps: readonly HexCoord[];
    }[] = [
      {
        origin: { q: -6, r: 6 },
        destination: { q: -8, r: 6 },
        expectedSteps: [{ q: -7, r: 6 }, { q: -8, r: 6 }],
      },
      {
        origin: { q: 1, r: -8 },
        destination: { q: 1, r: -6 },
        expectedSteps: [{ q: 1, r: -7 }, { q: 1, r: -6 }],
      },
      {
        origin: { q: 1, r: 3 },
        destination: { q: 1, r: 5 },
        expectedSteps: [{ q: 1, r: 4 }, { q: 1, r: 5 }],
      },
    ];
    for (const route of shallowWaterCrossingRoutes) {
      expect(gameMap.findShortestPath(
        route.origin,
        route.destination,
        MovementType.Ground,
        shallowWaterRouteActionPointCost,
      )).toEqual({
        cost: shallowWaterRouteActionPointCost,
        steps: route.expectedSteps,
      });
      expect(gameMap.findShortestPath(
        route.origin,
        route.destination,
        MovementType.Ground,
        insufficientShallowWaterRouteActionPointBudget,
      )).toBeUndefined();
    }

    expect(gameMap.findShortestPath(
      level.player.position,
      { q: -8, r: 1 },
      MovementType.Ground,
      shallowWaterUphillRouteActionPointCost,
    )).toEqual({
      cost: shallowWaterUphillRouteActionPointCost,
      steps: [{ q: -7, r: 0 }, { q: -8, r: 1 }],
    });
    for (const definition of [level.player, ...level.units]) {
      expect(definition).not.toHaveProperty("maxHp");
      expect(definition).not.toHaveProperty("currentHp");
    }
    expect(level.units).toHaveLength(9);
    expect(level.units.filter((unit) => unit.faction === Faction.Player))
      .toHaveLength(2);
    expect(level.units.filter((unit) => unit.faction === Faction.Enemy))
      .toHaveLength(7);
    expect(level.units.filter((unit) => unit.faction === Faction.Neutral))
      .toHaveLength(0);
    expect(level.units[0]).toMatchObject({
      id: "friendly-1",
      position: { q: -5, r: 0 },
      texture: UnitTexture.AllyIdle,
      faction: Faction.Player,
      movementType: MovementType.Ground,
      movementRange: 3,
      attackPower: 20,
      attributes: {
        [TacticalAttribute.Might]: 10,
        [TacticalAttribute.Finesse]: 11,
        [TacticalAttribute.Vitality]: 12,
        [TacticalAttribute.Insight]: 9,
      },
    });
    expect(level.units[1]).toMatchObject({
      id: "enemy-1",
      position: { q: 2, r: 0 },
      texture: UnitTexture.EnemyIdle,
      faction: Faction.Enemy,
      attributes: {
        [TacticalAttribute.Might]: 14,
        [TacticalAttribute.Finesse]: 9,
        [TacticalAttribute.Vitality]: 12,
        [TacticalAttribute.Insight]: 10,
      },
    });
    expect(level.units[2]).toMatchObject({
      id: "friendly-2",
      position: { q: -6, r: 1 },
      texture: UnitTexture.AllyIdle,
      faction: Faction.Player,
      attributes: {
        [TacticalAttribute.Might]: 9,
        [TacticalAttribute.Finesse]: 12,
        [TacticalAttribute.Vitality]: 11,
        [TacticalAttribute.Insight]: 11,
      },
    });
    expect(level.units.filter((unit) => unit.faction === Faction.Enemy)
      .map((unit) => ({ id: unit.id, position: unit.position }))).toEqual([
      { id: "enemy-1", position: { q: 2, r: 0 } },
      { id: "enemy-2", position: { q: 9, r: 0 } },
      { id: "enemy-3", position: { q: 6, r: -9 } },
      { id: "enemy-4", position: { q: 0, r: -9 } },
      { id: "enemy-5", position: { q: 3, r: 6 } },
      { id: "enemy-6", position: { q: -3, r: 9 } },
      { id: "enemy-7", position: { q: -9, r: 5 } },
    ]);
    const playerFactionServants = level.units.filter(
      (unit) => unit.faction === Faction.Player,
    );
    const occupiedPositionKeys = [level.player, ...level.units].map(
      (unit) => `${unit.position.q},${unit.position.r}`,
    );
    expect(new Set(occupiedPositionKeys).size).toBe(occupiedPositionKeys.length);
    expect(playerFactionServants.every((servant) =>
      hexDistance(level.player.position, servant.position) === 1
      && gameMap.getField(servant.position.q, servant.position.r)
        ?.getAllowedMovements()[MovementType.Ground],
    )).toBe(true);
  });
});

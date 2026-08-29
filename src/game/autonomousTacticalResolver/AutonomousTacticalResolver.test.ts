import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  AutonomousMemoryDirectiveType,
  resolveAutonomousTacticalDecision,
  type AutonomousTacticalResolverInput,
  type AutonomousUnitSnapshot,
} from "@/game/autonomousTacticalResolver/AutonomousTacticalResolver";
import { getHexCoordKey } from "@/game/board/hexCoord/HexCoord";
import { Faction } from "@/game/faction/Faction";
import {
  TacticalActionPointCost,
  TimelineAction,
} from "@/game/eventTimeline/EventTimeline";
import {
  groundUphillAdditionalActionPointCost,
  shallowWaterLeavingCostMultiplier,
} from "@/game/movement/GroundMovementRules";
import { ServantStrategyType } from "@/game/unit/servantStrategy/ServantStrategy";
import { UnitTacticalRole } from "@/game/unit/Unit";
import { MovementType, TerrainType, type MapArray } from "@/game/types";

const standardLeavingCostMultiplier = 1;

const mapData: MapArray = [-1, 0, 1, 2, 3].map((q) => ({
  q,
  r: 0,
  fieldAttrs: {
    terrainType: TerrainType.Grass,
    allowedMovements: {
      [MovementType.Ground]: true,
      [MovementType.Flying]: true,
    },
    groundLevel: 0,
    leavingCostMultiplier: standardLeavingCostMultiplier,
  },
}));

const gameMap = new GameMap(mapData);

function unit(
  id: string,
  faction: Faction,
  q: number,
  options: Partial<Pick<
    AutonomousUnitSnapshot,
    "isAlive" | "tacticalRole" | "viewRange"
  >> = {},
): AutonomousUnitSnapshot {
  return {
    id,
    faction,
    movementType: MovementType.Ground,
    tacticalRole: options.tacticalRole ?? UnitTacticalRole.None,
    viewRange: options.viewRange ?? 4,
    isAlive: options.isAlive ?? true,
    position: { q, r: 0 },
  };
}

function input(
  actorId: string,
  units: readonly AutonomousUnitSnapshot[],
  overrides: Partial<Omit<
    AutonomousTacticalResolverInput,
    "gameMap" | "actorId" | "units"
  >> = {},
  tacticalGameMap: GameMap = gameMap,
): AutonomousTacticalResolverInput {
  return {
    gameMap: tacticalGameMap,
    units,
    unitsById: new Map(units.map((unit) => [unit.id, unit])),
    livingUnitIdByHex: new Map(units
      .filter((unit) => unit.isAlive)
      .map((unit) => [getHexCoordKey(unit.position), unit.id])),
    actorId,
    mageId: "mage",
    remainingActionPoints: 3,
    enemyMemory: { lastKnownHostilePosition: undefined },
    servantMemory: { defaultTargetId: undefined },
    servantStrategy: undefined,
    ...overrides,
  };
}

describe("AutonomousTacticalResolver", () => {
  it("derives an exact Shallow Water uphill cost for a semantic Move", () => {
    const shallowWaterGroundLevel = 0;
    const uphillGroundLevel = 1;
    const shallowWaterUphillActionPointCost = TacticalActionPointCost.Move
      * shallowWaterLeavingCostMultiplier
      + groundUphillAdditionalActionPointCost;
    const shallowWaterMap = new GameMap([
      {
        q: 0,
        r: 0,
        fieldAttrs: {
          terrainType: TerrainType.ShallowWater,
          allowedMovements: {
            [MovementType.Ground]: true,
            [MovementType.Flying]: true,
          },
          groundLevel: shallowWaterGroundLevel,
          leavingCostMultiplier: shallowWaterLeavingCostMultiplier,
        },
      },
      {
        q: 1,
        r: 0,
        fieldAttrs: {
          terrainType: TerrainType.Grass,
          allowedMovements: {
            [MovementType.Ground]: true,
            [MovementType.Flying]: true,
          },
          groundLevel: uphillGroundLevel,
          leavingCostMultiplier: standardLeavingCostMultiplier,
        },
      },
      {
        q: 2,
        r: 0,
        fieldAttrs: {
          terrainType: TerrainType.Grass,
          allowedMovements: {
            [MovementType.Ground]: true,
            [MovementType.Flying]: true,
          },
          groundLevel: uphillGroundLevel,
          leavingCostMultiplier: standardLeavingCostMultiplier,
        },
      },
    ]);
    const enemy = unit("enemy", Faction.Enemy, 0);
    const mage = unit(
      "mage",
      Faction.Player,
      2,
      { tacticalRole: UnitTacticalRole.Mage },
    );

    expect(resolveAutonomousTacticalDecision(input(
      enemy.id,
      [enemy, mage],
      {},
      shallowWaterMap,
    ))).toMatchObject({
      action: TimelineAction.Move,
      destination: { q: 1, r: 0 },
      actionPointCost: shallowWaterUphillActionPointCost,
    });
    expect(resolveAutonomousTacticalDecision(input(
      enemy.id,
      [enemy, mage],
      {
        remainingActionPoints: shallowWaterUphillActionPointCost
          - TacticalActionPointCost.Move,
      },
      shallowWaterMap,
    ))).toMatchObject({ action: TimelineAction.Wait });
  });

  it("uses unit registration order to break an Enemy's equally near hostile tie", () => {
    const enemy = unit("enemy", Faction.Enemy, 0);
    const mage = unit(
      "mage",
      Faction.Player,
      1,
      { tacticalRole: UnitTacticalRole.Mage },
    );
    const servant = unit("servant", Faction.Player, -1);
    const decision = resolveAutonomousTacticalDecision(
      input(enemy.id, [enemy, mage, servant]),
    );

    expect(decision).toEqual({
      action: TimelineAction.Attack,
      targetId: mage.id,
      memoryDirectives: [{
        type: AutonomousMemoryDirectiveType.RememberEnemyHostile,
        hostileId: mage.id,
        position: { q: 1, r: 0 },
      }],
      clearServantStrategy: false,
    });
    expect(enemy.position).toEqual({ q: 0, r: 0 });
    expect(mage.position).toEqual({ q: 1, r: 0 });
  });

  it("moves an Enemy one deterministic step toward a last-known position without target omniscience", () => {
    const enemy = unit("enemy", Faction.Enemy, 0, { viewRange: 1 });
    const mage = unit(
      "mage",
      Faction.Player,
      3,
      { tacticalRole: UnitTacticalRole.Mage },
    );
    const decision = resolveAutonomousTacticalDecision(input(
      enemy.id,
      [enemy, mage],
      {
        enemyMemory: { lastKnownHostilePosition: { q: 3, r: 0 } },
      },
    ));

    expect(decision).toEqual({
      action: TimelineAction.Move,
      destination: { q: 1, r: 0 },
      actionPointCost: TacticalActionPointCost.Move,
      memoryDirectives: [],
      clearServantStrategy: false,
    });
  });

  it("returns memory directives for default-servant retargeting instead of mutating memory", () => {
    const mage = unit(
      "mage",
      Faction.Player,
      -1,
      { tacticalRole: UnitTacticalRole.Mage },
    );
    const servant = unit("servant", Faction.Player, 0);
    const defeatedEnemy = unit("defeated", Faction.Enemy, 1, { isAlive: false });
    const enemy = unit("enemy", Faction.Enemy, 2);
    const decision = resolveAutonomousTacticalDecision(input(
      servant.id,
      [mage, servant, defeatedEnemy, enemy],
      { servantMemory: { defaultTargetId: defeatedEnemy.id } },
    ));

    expect(decision).toEqual({
      action: TimelineAction.Move,
      destination: { q: 1, r: 0 },
      actionPointCost: TacticalActionPointCost.Move,
      memoryDirectives: [
        { type: AutonomousMemoryDirectiveType.ClearServantDefaultTarget },
        {
          type: AutonomousMemoryDirectiveType.RememberServantDefaultTarget,
          targetId: enemy.id,
        },
      ],
      clearServantStrategy: false,
    });
  });

  it("returns a strategy-clear directive for an invalid designated Enemy", () => {
    const mage = unit(
      "mage",
      Faction.Player,
      -1,
      { tacticalRole: UnitTacticalRole.Mage },
    );
    const servant = unit("servant", Faction.Player, 0);
    const defeatedEnemy = unit("defeated", Faction.Enemy, 1, { isAlive: false });
    const decision = resolveAutonomousTacticalDecision(input(
      servant.id,
      [mage, servant, defeatedEnemy],
      {
        servantStrategy: {
          type: ServantStrategyType.PursueDesignatedEnemy,
          targetEnemyId: defeatedEnemy.id,
        },
      },
    ));

    expect(decision).toEqual({
      action: TimelineAction.Wait,
      memoryDirectives: [],
      clearServantStrategy: true,
    });
  });

  it("lets Hold attack an adjacent hostile but waits when its AP is insufficient", () => {
    const mage = unit(
      "mage",
      Faction.Player,
      -1,
      { tacticalRole: UnitTacticalRole.Mage },
    );
    const servant = unit("servant", Faction.Player, 0);
    const enemy = unit("enemy", Faction.Enemy, 1);
    const strategy = { type: ServantStrategyType.Hold } as const;

    expect(resolveAutonomousTacticalDecision(input(
      servant.id,
      [mage, servant, enemy],
      { servantStrategy: strategy },
    ))).toMatchObject({ action: TimelineAction.Attack, targetId: enemy.id });
    expect(resolveAutonomousTacticalDecision(input(
      servant.id,
      [mage, servant, enemy],
      { servantStrategy: strategy, remainingActionPoints: 1 },
    ))).toEqual({
      action: TimelineAction.Wait,
      memoryDirectives: [],
      clearServantStrategy: false,
    });
  });

  it("moves a Secure servant toward its designated hex without entering an occupied objective", () => {
    const mage = unit(
      "mage",
      Faction.Player,
      -1,
      { tacticalRole: UnitTacticalRole.Mage },
    );
    const servant = unit("servant", Faction.Player, 0);
    const enemy = unit("enemy", Faction.Enemy, 2);
    const decision = resolveAutonomousTacticalDecision(input(
      servant.id,
      [mage, servant, enemy],
      {
        servantStrategy: {
          type: ServantStrategyType.SecureDesignatedHex,
          targetHex: enemy.position,
        },
      },
    ));

    expect(decision).toMatchObject({
      action: TimelineAction.Move,
      destination: { q: 1, r: 0 },
      actionPointCost: TacticalActionPointCost.Move,
    });
  });

  it("makes Protect Mage attack a perceived adjacent threat before moving", () => {
    const mage = unit(
      "mage",
      Faction.Player,
      0,
      { tacticalRole: UnitTacticalRole.Mage },
    );
    const servant = unit("servant", Faction.Player, 1);
    const enemy = unit("enemy", Faction.Enemy, 2);
    const decision = resolveAutonomousTacticalDecision(input(
      servant.id,
      [mage, servant, enemy],
      { servantStrategy: { type: ServantStrategyType.ProtectMage } },
    ));

    expect(decision).toMatchObject({
      action: TimelineAction.Attack,
      targetId: enemy.id,
    });
  });

  it("waits when a last-known Enemy pursuit has no unoccupied reducing step", () => {
    const enemy = unit("enemy", Faction.Enemy, 0, { viewRange: 1 });
    const friendlyBlocker = unit("enemy-blocker", Faction.Enemy, 1);
    const mage = unit(
      "mage",
      Faction.Player,
      3,
      { tacticalRole: UnitTacticalRole.Mage },
    );
    const decision = resolveAutonomousTacticalDecision(input(
      enemy.id,
      [enemy, friendlyBlocker, mage],
      { enemyMemory: { lastKnownHostilePosition: mage.position } },
    ));

    expect(decision).toEqual({
      action: TimelineAction.Wait,
      memoryDirectives: [],
      clearServantStrategy: false,
    });
  });

  it("clears Enemy last-known memory after visibility is lost and its destination is reached", () => {
    const mage = unit(
      "mage",
      Faction.Player,
      -1,
      { tacticalRole: UnitTacticalRole.Mage },
    );
    const enemy = unit("enemy", Faction.Enemy, 2, { viewRange: 1 });
    const decision = resolveAutonomousTacticalDecision(input(
      enemy.id,
      [mage, enemy],
      { enemyMemory: { lastKnownHostilePosition: enemy.position } },
    ));

    expect(decision).toEqual({
      action: TimelineAction.Wait,
      memoryDirectives: [
        { type: AutonomousMemoryDirectiveType.ClearEnemyMemory },
      ],
      clearServantStrategy: false,
    });
  });
});

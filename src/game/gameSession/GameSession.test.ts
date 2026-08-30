import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  DoorBlockInitialState,
  TacticalHexAxis,
  TacticalHexStructureType,
  WallBlockSideMaterial,
} from "@/game/board/structure/TacticalHexStructure";
import { Faction } from "@/game/faction/Faction";
import {
  GameActionPreviewType,
  GameActionRejectionReason,
  GameActionType,
  GameSession,
  InitiativeQueueActorLabel,
  InitiativeQueueCardState,
  TacticalPresentationEventKind,
} from "@/game/gameSession/GameSession";
import {
  actionPointsPerActivation,
  baseTimelineRecoveryDelay,
  TacticalActionPointCost,
} from "@/game/eventTimeline/EventTimeline";
import {
  groundUphillAdditionalActionPointCost,
  groundUphillMovementActionPointCost,
  shallowWaterLeavingCostMultiplier,
} from "@/game/movement/GroundMovementRules";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
import { ServantStrategyType } from "@/game/unit/servantStrategy/ServantStrategy";
import { TacticalAttribute } from "@/game/unit/tacticalAttributes/TacticalAttributes";
import {
  MovementType,
  TerrainType,
  type HexCoord,
  type MapArray,
} from "@/game/types";
import { FieldVisibility } from "@/game/visibility/MageVisibility";

const standardLeavingCostMultiplier = 1;
const shallowWaterUphillActionPointCost = TacticalActionPointCost.Move
  * shallowWaterLeavingCostMultiplier
  + groundUphillAdditionalActionPointCost;
const structureBlockingMageStart = { q: 0, r: 0 };
const structureBlockingField = { q: 1, r: 0 };
const structureBlockedEnemyField = { q: 2, r: 0 };
const structureBlockingWallId = "session-blocking-wall";
const structureBlockedEnemyId = "structure-blocked-enemy";
const doorMageStart = { q: 0, r: 0 };
const doorField = { q: 1, r: 0 };
const doorBlockedEnemyField = { q: 2, r: 0 };
const doorBlockId = "session-door";
const doorBlockedEnemyId = "door-blocked-enemy";
const distantDoorField = { q: 2, r: 0 };
const windowBlockId = "session-window";
const windowBlockedEnemyId = "window-blocked-enemy";

const mapData: MapArray = [
  { q: 0, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: 1, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: 2, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: 3, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: -1, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: 0, r: -1, fieldAttrs: field(TerrainType.Grass) },
  { q: 0, r: -2, fieldAttrs: field(TerrainType.Grass) },
  { q: 0, r: -3, fieldAttrs: field(TerrainType.Grass) },
  { q: 0, r: 1, fieldAttrs: field(TerrainType.Water, false) },
];

function field(
  terrainType: TerrainType,
  ground = true,
  groundLevel = 0,
  leavingCostMultiplier = standardLeavingCostMultiplier,
) {
  return {
    terrainType,
    allowedMovements: {
      [MovementType.Ground]: ground,
      [MovementType.Flying]: true,
    },
    groundLevel,
    leavingCostMultiplier,
  };
}

function createGrassMap(coords: readonly HexCoord[]): MapArray {
  return coords.map(({ q, r }) => ({
    q,
    r,
    fieldAttrs: field(TerrainType.Grass),
  }));
}

function createSession(): {
  session: GameSession;
  player: Player;
  playerAlly: Unit;
  enemy: Unit;
  neutral: Unit;
} {
  const player = new Player("player", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
    attributes: { [TacticalAttribute.Vitality]: 12 },
  });
  const playerAlly = new Unit(
    "player-ally",
    { q: -1, r: 0 },
    UnitTexture.PlayerIdle,
    { faction: Faction.Player },
  );
  const enemy = new Unit("enemy", { q: 2, r: 0 }, UnitTexture.EnemyIdle, {
    faction: Faction.Enemy,
  });
  const neutral = new Unit("neutral", { q: 3, r: 0 }, UnitTexture.EnemyIdle, {
    faction: Faction.Neutral,
  });

  return {
    session: new GameSession(
      new GameMap(mapData),
      [player, playerAlly, enemy, neutral],
    ),
    player,
    playerAlly,
    enemy,
    neutral,
  };
}

describe("GameSession", () => {
  it("keeps Ground previews and fog-safe unit projections behind a WallBlock unavailable", () => {
    const mage = new Player(
      "mage",
      structureBlockingMageStart,
      UnitTexture.PlayerIdle,
      { viewRange: 3 },
    );
    const hiddenEnemy = new Unit(
      structureBlockedEnemyId,
      structureBlockedEnemyField,
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(new GameMap(
      createGrassMap([
        structureBlockingMageStart,
        structureBlockingField,
        structureBlockedEnemyField,
      ]),
      [{
        id: structureBlockingWallId,
        ...structureBlockingField,
        structure: {
          type: TacticalHexStructureType.WallBlock,
          sideMaterial: WallBlockSideMaterial.Stone,
        },
      }],
    ), [mage, hiddenEnemy]);

    expect(session.clickHex(structureBlockingMageStart)).toEqual({
      type: GameActionType.Selected,
      unitId: mage.id,
    });
    expect(session.getReachableHexes()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ coord: structureBlockingField }),
      expect.objectContaining({ coord: structureBlockedEnemyField }),
    ]));
    expect(session.previewHex(structureBlockingField)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.OutOfRange,
    });
    expect(session.clickHex(structureBlockingField)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.OutOfRange,
    });
    expect(mage.position).toEqual(structureBlockingMageStart);
    expect(session.getFieldVisibility(structureBlockedEnemyField)).toBe(
      FieldVisibility.Undiscovered,
    );
    expect(session.isUnitVisible(hiddenEnemy)).toBe(false);
    expect(session.initiativeQueuePresentation.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        state: InitiativeQueueCardState.Unknown,
        unitId: undefined,
        canHighlight: false,
      }),
    ]));
  });

  it("toggles an adjacent DoorBlock for one Mage AP and updates movement and fog", () => {
    const mage = new Player(
      "mage",
      doorMageStart,
      UnitTexture.PlayerIdle,
      { viewRange: 3 },
    );
    const hiddenEnemy = new Unit(
      doorBlockedEnemyId,
      doorBlockedEnemyField,
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(new GameMap(
      createGrassMap([doorMageStart, doorField, doorBlockedEnemyField]),
      [{
        id: doorBlockId,
        ...doorField,
        structure: {
          type: TacticalHexStructureType.DoorBlock,
          axis: TacticalHexAxis.Q,
          initialState: DoorBlockInitialState.Closed,
        },
      }],
    ), [mage, hiddenEnemy]);

    expect(session.getFieldVisibility(doorBlockedEnemyField)).toBe(
      FieldVisibility.Undiscovered,
    );
    expect(session.clickHex(doorMageStart)).toEqual({
      type: GameActionType.Selected,
      unitId: mage.id,
    });
    expect(session.getReachableHexes()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ coord: doorField }),
    ]));
    expect(session.previewHex(doorField)).toEqual({
      type: GameActionPreviewType.ValidDoorInteraction,
      mageId: mage.id,
      doorBlockId,
      currentState: DoorBlockInitialState.Closed,
    });

    expect(session.clickHex(doorField)).toEqual({
      type: GameActionType.DoorToggled,
      mageId: mage.id,
      doorBlockId,
      previousState: DoorBlockInitialState.Closed,
      nextState: DoorBlockInitialState.Open,
    });
    expect(session.eventTimeline.getRemainingActionPoints(mage.id)).toBe(
      actionPointsPerActivation - TacticalActionPointCost.DoorInteraction,
    );
    expect(session.getReachableHexes()).toEqual(expect.arrayContaining([
      expect.objectContaining({ coord: doorField }),
    ]));
    expect(session.getFieldVisibility(doorBlockedEnemyField)).toBe(
      FieldVisibility.Visible,
    );
    expect(session.isUnitVisible(hiddenEnemy)).toBe(true);

    expect(session.clickHex(doorField)).toEqual({
      type: GameActionType.DoorToggled,
      mageId: mage.id,
      doorBlockId,
      previousState: DoorBlockInitialState.Open,
      nextState: DoorBlockInitialState.Closed,
    });
    expect(session.eventTimeline.getRemainingActionPoints(mage.id)).toBe(
      actionPointsPerActivation - (TacticalActionPointCost.DoorInteraction * 2),
    );
    expect(session.getReachableHexes()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ coord: doorField }),
    ]));
    expect(session.getFieldVisibility(doorBlockedEnemyField)).toBe(
      FieldVisibility.Discovered,
    );
    expect(session.isUnitVisible(hiddenEnemy)).toBe(false);
  });

  it("rejects a non-adjacent DoorBlock interaction without spending Mage AP", () => {
    const mage = new Player("mage", doorMageStart, UnitTexture.PlayerIdle, {
      viewRange: 3,
    });
    const session = new GameSession(new GameMap(
      createGrassMap([
        doorMageStart,
        doorField,
        distantDoorField,
      ]),
      [{
        id: doorBlockId,
        ...distantDoorField,
        structure: {
          type: TacticalHexStructureType.DoorBlock,
          axis: TacticalHexAxis.R,
          initialState: DoorBlockInitialState.Closed,
        },
      }],
    ), [mage]);

    session.clickHex(doorMageStart);

    expect(session.previewHex(distantDoorField)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.OutOfRange,
    });
    expect(session.clickHex(distantDoorField)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.OutOfRange,
    });
    expect(session.eventTimeline.getRemainingActionPoints(mage.id)).toBe(
      actionPointsPerActivation,
    );
  });

  it("lets autonomous Ground units perceive and cross a DoorBlock only after the Mage opens it", () => {
    const mage = new Player(
      "mage",
      doorMageStart,
      UnitTexture.PlayerIdle,
      { viewRange: 3 },
    );
    const enemy = new Unit(
      doorBlockedEnemyId,
      doorBlockedEnemyField,
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(new GameMap(
      createGrassMap([doorMageStart, doorField, doorBlockedEnemyField]),
      [{
        id: doorBlockId,
        ...doorField,
        structure: {
          type: TacticalHexStructureType.DoorBlock,
          axis: TacticalHexAxis.S,
          initialState: DoorBlockInitialState.Closed,
        },
      }],
    ), [mage, enemy]);

    expect(enemy.position).toEqual(doorBlockedEnemyField);
    session.clickHex(doorMageStart);
    session.clickHex(doorField);
    session.endMageTurn();

    expect(enemy.position).toEqual(doorField);
  });

  it("blocks Ground movement at a WindowBlock while applying its sight axis", () => {
    const alignedMage = new Player(
      "aligned-mage",
      doorMageStart,
      UnitTexture.PlayerIdle,
      { viewRange: 3 },
    );
    const alignedEnemy = new Unit(
      windowBlockedEnemyId,
      doorBlockedEnemyField,
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const alignedSession = new GameSession(new GameMap(
      createGrassMap([doorMageStart, doorField, doorBlockedEnemyField]),
      [{
        id: windowBlockId,
        ...doorField,
        structure: {
          type: TacticalHexStructureType.WindowBlock,
          axis: TacticalHexAxis.Q,
        },
      }],
    ), [alignedMage, alignedEnemy]);

    expect(alignedSession.getFieldVisibility(doorBlockedEnemyField)).toBe(
      FieldVisibility.Visible,
    );
    alignedSession.clickHex(doorMageStart);
    expect(alignedSession.getReachableHexes()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ coord: doorField }),
    ]));
    expect(alignedSession.previewHex(doorField)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.OutOfRange,
    });

    const crossAxisMage = new Player(
      "cross-axis-mage",
      doorMageStart,
      UnitTexture.PlayerIdle,
      { viewRange: 3 },
    );
    const crossAxisEnemy = new Unit(
      windowBlockedEnemyId,
      doorBlockedEnemyField,
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const crossAxisSession = new GameSession(new GameMap(
      createGrassMap([doorMageStart, doorField, doorBlockedEnemyField]),
      [{
        id: windowBlockId,
        ...doorField,
        structure: {
          type: TacticalHexStructureType.WindowBlock,
          axis: TacticalHexAxis.R,
        },
      }],
    ), [crossAxisMage, crossAxisEnemy]);

    expect(crossAxisSession.getFieldVisibility(doorBlockedEnemyField)).toBe(
      FieldVisibility.Undiscovered,
    );
    expect(crossAxisSession.initiativeQueuePresentation.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: InitiativeQueueCardState.Unknown,
          unitId: undefined,
          canHighlight: false,
        }),
      ]),
    );
  });

  it("derives Mage Shallow Water highlights including a legal uphill exit", () => {
    const mageStart = { q: 0, r: 0 };
    const shallowWaterHex = { q: 1, r: 0 };
    const uphillDestination = { q: 2, r: 0 };
    const deepWaterHex = { q: 1, r: 1 };
    const mage = new Player("mage", mageStart, UnitTexture.PlayerIdle);
    const session = new GameSession(
      new GameMap([
        { ...mageStart, fieldAttrs: field(TerrainType.Grass) },
        {
          ...shallowWaterHex,
          fieldAttrs: field(
            TerrainType.ShallowWater,
            true,
            0,
            shallowWaterLeavingCostMultiplier,
          ),
        },
        { ...uphillDestination, fieldAttrs: field(TerrainType.Grass, true, 1) },
        { ...deepWaterHex, fieldAttrs: field(TerrainType.Water, false) },
      ]),
      [mage],
    );

    expect(session.clickHex(mageStart)).toEqual({
      type: GameActionType.Selected,
      unitId: mage.id,
    });
    expect(session.getReachableHexes()).toEqual(expect.arrayContaining([
      { coord: shallowWaterHex, cost: TacticalActionPointCost.Move },
    ]));
    expect(session.previewHex(shallowWaterHex)).toEqual({
      type: GameActionPreviewType.ValidMove,
      unitId: mage.id,
      destination: shallowWaterHex,
      path: {
        cost: TacticalActionPointCost.Move,
        steps: [shallowWaterHex],
      },
    });
    expect(session.clickHex(shallowWaterHex)).toEqual({
      type: GameActionType.Moved,
      unitId: mage.id,
      from: mageStart,
      to: shallowWaterHex,
    });
    expect(session.getReachableHexes()).toEqual(expect.arrayContaining([
      {
        coord: uphillDestination,
        cost: shallowWaterUphillActionPointCost,
      },
    ]));
    expect(session.previewHex(uphillDestination)).toEqual({
      type: GameActionPreviewType.ValidMove,
      unitId: mage.id,
      destination: uphillDestination,
      path: {
        cost: shallowWaterUphillActionPointCost,
        steps: [uphillDestination],
      },
    });
    expect(session.previewHex(deepWaterHex)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.OutOfRange,
    });
  });

  it("uses weighted Ground elevation paths consistently for highlights and Mage AP", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const climbHex = { q: 1, r: 0 };
    const plateauHex = { q: 2, r: 0 };
    const steepHex = { q: -1, r: 0 };
    const session = new GameSession(
      new GameMap([
        { q: 0, r: 0, fieldAttrs: field(TerrainType.Grass, true, 0) },
        { ...climbHex, fieldAttrs: field(TerrainType.Grass, true, 1) },
        { ...plateauHex, fieldAttrs: field(TerrainType.Grass, true, 1) },
        { ...steepHex, fieldAttrs: field(TerrainType.Grass, true, 2) },
      ]),
      [mage],
    );

    session.clickHex(mage.position);
    expect(session.getReachableHexes()).toEqual(expect.arrayContaining([
      { coord: climbHex, cost: groundUphillMovementActionPointCost },
      {
        coord: plateauHex,
        cost: groundUphillMovementActionPointCost + TacticalActionPointCost.Move,
      },
    ]));
    expect(session.getReachableHexes()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ coord: steepHex }),
    ]));
    expect(session.previewHex(climbHex)).toMatchObject({
      type: GameActionPreviewType.ValidMove,
      path: { cost: groundUphillMovementActionPointCost, steps: [climbHex] },
    });
    expect(session.previewHex(steepHex)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.OutOfRange,
    });

    session.clickHex(climbHex);
    expect(session.timelinePresentation.readyActorActionPoints).toBe(
      actionPointsPerActivation - groundUphillMovementActionPointCost,
    );
    expect(session.clickHex(plateauHex)).toMatchObject({
      type: GameActionType.Moved,
      to: plateauHex,
    });
  });

  it("charges autonomous Ground units two AP for an uphill step", () => {
    const enemy = new Unit("enemy", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const mage = new Player("mage", { q: 2, r: 0 }, UnitTexture.PlayerIdle);
    const session = new GameSession(
      new GameMap([
        { q: 0, r: 0, fieldAttrs: field(TerrainType.Grass, true, 0) },
        { q: 1, r: 0, fieldAttrs: field(TerrainType.Grass, true, 1) },
        { q: 2, r: 0, fieldAttrs: field(TerrainType.Grass, true, 1) },
      ]),
      [mage, enemy],
    );

    session.waitForMage();

    expect(enemy.position).toEqual({ q: 1, r: 0 });
    expect(mage.currentHp).toBe(mage.maxHp - enemy.attackPower);
    expect(session.eventTimeline.getNextReadyAt(enemy.id)).toBe(
      baseTimelineRecoveryDelay,
    );
  });

  it("charges an autonomous Ground unit two AP when it exits Shallow Water at the same level", () => {
    const enemy = new Unit("enemy", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const mage = new Player("mage", { q: 2, r: 0 }, UnitTexture.PlayerIdle);
    const session = new GameSession(
      new GameMap([
        {
          q: 0,
          r: 0,
          fieldAttrs: field(
            TerrainType.ShallowWater,
            true,
            0,
            shallowWaterLeavingCostMultiplier,
          ),
        },
        { q: 1, r: 0, fieldAttrs: field(TerrainType.Grass, true, 0) },
        { q: 2, r: 0, fieldAttrs: field(TerrainType.Grass, true, 0) },
      ]),
      [mage, enemy],
    );

    session.waitForMage();

    expect(enemy.position).toEqual({ q: 1, r: 0 });
    expect(mage.currentHp).toBe(mage.maxHp - enemy.attackPower);
    expect(session.eventTimeline.getNextReadyAt(enemy.id)).toBe(
      baseTimelineRecoveryDelay,
    );
  });

  it("charges an autonomous Ground unit two AP when it exits Shallow Water downhill", () => {
    const shallowWaterGroundLevel = 1;
    const downhillGroundLevel = 0;
    const enemy = new Unit("enemy", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const mage = new Player("mage", { q: 2, r: 0 }, UnitTexture.PlayerIdle);
    const session = new GameSession(
      new GameMap([
        {
          q: 0,
          r: 0,
          fieldAttrs: field(
            TerrainType.ShallowWater,
            true,
            shallowWaterGroundLevel,
            shallowWaterLeavingCostMultiplier,
          ),
        },
        { q: 1, r: 0, fieldAttrs: field(TerrainType.Grass, true, downhillGroundLevel) },
        { q: 2, r: 0, fieldAttrs: field(TerrainType.Grass, true, downhillGroundLevel) },
      ]),
      [mage, enemy],
    );

    session.waitForMage();

    expect(enemy.position).toEqual({ q: 1, r: 0 });
    expect(mage.currentHp).toBe(mage.maxHp - enemy.attackPower);
    expect(session.eventTimeline.getNextReadyAt(enemy.id)).toBe(
      baseTimelineRecoveryDelay,
    );
  });

  it("charges an autonomous Ground unit three AP when it exits Shallow Water uphill", () => {
    const shallowWaterGroundLevel = 0;
    const uphillGroundLevel = 1;
    const enemy = new Unit("enemy", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const mage = new Player("mage", { q: 2, r: 0 }, UnitTexture.PlayerIdle);
    const session = new GameSession(
      new GameMap([
        {
          q: 0,
          r: 0,
          fieldAttrs: field(
            TerrainType.ShallowWater,
            true,
            shallowWaterGroundLevel,
            shallowWaterLeavingCostMultiplier,
          ),
        },
        { q: 1, r: 0, fieldAttrs: field(TerrainType.Grass, true, uphillGroundLevel) },
        { q: 2, r: 0, fieldAttrs: field(TerrainType.Grass, true, uphillGroundLevel) },
      ]),
      [mage, enemy],
    );

    session.waitForMage();

    expect(enemy.position).toEqual({ q: 1, r: 0 });
    expect(mage.currentHp).toBe(mage.maxHp);
    expect(session.eventTimeline.getNextReadyAt(enemy.id)).toBe(
      baseTimelineRecoveryDelay,
    );
  });

  it("makes an autonomous Ground unit wait when remaining AP cannot exit Shallow Water uphill", () => {
    const enemy = new Unit("enemy", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const mage = new Player("mage", { q: 3, r: 0 }, UnitTexture.PlayerIdle);
    const session = new GameSession(
      new GameMap([
        {
          q: 0,
          r: 0,
          fieldAttrs: field(
            TerrainType.ShallowWater,
            true,
            0,
            shallowWaterLeavingCostMultiplier,
          ),
        },
        {
          q: 1,
          r: 0,
          fieldAttrs: field(
            TerrainType.ShallowWater,
            true,
            0,
            shallowWaterLeavingCostMultiplier,
          ),
        },
        { q: 2, r: 0, fieldAttrs: field(TerrainType.Grass, true, 1) },
        { q: 3, r: 0, fieldAttrs: field(TerrainType.Grass, true, 1) },
      ]),
      [mage, enemy],
    );

    session.waitForMage();

    expect(enemy.position).toEqual({ q: 1, r: 0 });
    expect(mage.currentHp).toBe(mage.maxHp);
    expect(session.eventTimeline.getNextReadyAt(enemy.id)).toBe(
      baseTimelineRecoveryDelay,
    );
  });

  it("prevents an Enemy from acquiring a hostile beyond a steep elevation blocker", () => {
    const enemy = new Unit("enemy", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
      viewRange: 3,
    });
    const mage = new Player("mage", { q: 2, r: 0 }, UnitTexture.PlayerIdle, {
      viewRange: 3,
    });
    const session = new GameSession(
      new GameMap([
        { q: 0, r: 0, fieldAttrs: field(TerrainType.Grass, true, 0) },
        { q: 1, r: 0, fieldAttrs: field(TerrainType.Grass, true, 2) },
        { q: 2, r: 0, fieldAttrs: field(TerrainType.Grass, true, 0) },
      ]),
      [mage, enemy],
    );

    session.waitForMage();

    expect(enemy.position).toEqual({ q: 0, r: 0 });
    expect(session.getEnemyLastKnownHostilePosition(enemy.id)).toBeUndefined();
  });

  it("does not expose an Enemy behind a steep blocker through Mage visibility", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      viewRange: 3,
    });
    const enemy = new Unit("enemy", { q: 2, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
      viewRange: 3,
    });
    const session = new GameSession(
      new GameMap([
        { q: 0, r: 0, fieldAttrs: field(TerrainType.Grass, true, 0) },
        { q: 1, r: 0, fieldAttrs: field(TerrainType.Grass, true, 2) },
        { q: 2, r: 0, fieldAttrs: field(TerrainType.Grass, true, 0) },
      ]),
      [mage, enemy],
    );

    expect(session.getFieldVisibility(enemy.position)).toBe(
      FieldVisibility.Undiscovered,
    );
    expect(session.isUnitVisible(enemy)).toBe(false);
  });

  it("publishes ordered immutable Move snapshots after authoritative player movement", () => {
    const { session, player } = createSession();
    session.clickHex(player.position);

    expect(session.clickHex({ q: 0, r: -2 })).toMatchObject({
      type: GameActionType.Moved,
      unitId: player.id,
    });
    const events = session.consumeTacticalPresentationEvents();
    expect(events).toEqual([
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Move,
        unit: expect.objectContaining({
          id: player.id,
          position: { q: 0, r: -2 },
          currentHp: player.currentHp,
          isAlive: true,
        }),
        from: { q: 0, r: 0 },
        steps: [{ q: 0, r: -1 }, { q: 0, r: -2 }],
      }),
    ]);
    expect(Object.isFrozen(events)).toBe(true);
    const firstEvent = events[0];
    if (!firstEvent || firstEvent.kind !== TacticalPresentationEventKind.Move) {
      throw new Error("Expected one Move presentation event");
    }
    expect(Object.isFrozen(firstEvent)).toBe(true);
    expect(Object.isFrozen(firstEvent.unit)).toBe(true);
    expect(Object.isFrozen(firstEvent.unit.position)).toBe(true);
    expect(Object.isFrozen(firstEvent.from)).toBe(true);
    expect(Object.isFrozen(firstEvent.steps)).toBe(true);
    expect(player.position).toEqual({ q: 0, r: -2 });
    expect(session.consumeTacticalPresentationEvents()).toEqual([]);
  });

  it("preserves autonomous Move then Attack event order independently of final state", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const enemy = new Unit("enemy", { q: 3, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 },
      ])),
      [mage, enemy],
    );

    session.waitForMage();

    expect(session.consumeTacticalPresentationEvents()).toEqual([
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Move,
        unit: expect.objectContaining({ id: enemy.id, position: { q: 2, r: 0 } }),
        from: { q: 3, r: 0 },
        steps: [{ q: 2, r: 0 }],
      }),
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Move,
        unit: expect.objectContaining({ id: enemy.id, position: { q: 1, r: 0 } }),
        from: { q: 2, r: 0 },
        steps: [{ q: 1, r: 0 }],
      }),
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Attack,
        attacker: expect.objectContaining({
          id: enemy.id,
          position: { q: 1, r: 0 },
        }),
        target: expect.objectContaining({
          id: mage.id,
          currentHp: mage.maxHp - enemy.attackPower,
        }),
      }),
    ]);
    expect(enemy.position).toEqual({ q: 1, r: 0 });
  });

  it("does not expose a move path that crossed currently hidden fields", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      viewRange: 1,
    });
    const enemy = new Unit("enemy", { q: 3, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 },
      ])),
      [mage, enemy],
    );

    session.waitForMage();

    const presentationEvents = session.consumeTacticalPresentationEvents();
    expect(presentationEvents.some((event) => (
      event.kind === TacticalPresentationEventKind.Move
    ))).toBe(false);
    expect(presentationEvents).toEqual([
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Attack,
        attacker: expect.objectContaining({ id: enemy.id }),
        target: expect.objectContaining({
          id: mage.id,
          currentHp: mage.maxHp - enemy.attackPower,
        }),
      }),
    ]);
    expect(session.consumeTacticalVisibilitySyncSignal()).toBe(true);
    expect(session.consumeTacticalVisibilitySyncSignal()).toBe(false);
  });

  it("publishes an autonomous Attack snapshot after every adjacent hostile hit", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const enemy = new Unit("enemy", { q: 1, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(
      new GameMap(createGrassMap([mage.position, enemy.position])),
      [mage, enemy],
    );

    session.waitForMage();

    expect(session.consumeTacticalPresentationEvents()).toEqual([
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Attack,
        attacker: expect.objectContaining({ id: enemy.id, isAlive: true }),
        target: expect.objectContaining({
          id: mage.id,
          currentHp: mage.maxHp - enemy.attackPower,
          isAlive: true,
        }),
      }),
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Attack,
        attacker: expect.objectContaining({ id: enemy.id, isAlive: true }),
        target: expect.objectContaining({
          id: mage.id,
          currentHp: mage.maxHp - enemy.attackPower * 2,
          isAlive: true,
        }),
      }),
    ]);
  });

  it("withholds known attacker data when Mage defeat removes current visibility", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      currentHp: 20,
    });
    const enemy = new Unit("enemy", { q: 1, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(
      new GameMap(createGrassMap([mage.position, enemy.position])),
      [mage, enemy],
    );

    session.waitForMage();

    expect(mage.isAlive).toBe(false);
    expect(session.consumeTacticalPresentationEvents()).toEqual([]);
    expect(session.consumeTacticalVisibilitySyncSignal()).toBe(true);
  });

  it("keeps direct control Mage-exclusive and selects a servant only as a command target", () => {
    const { session, playerAlly } = createSession();

    expect(session.clickHex({ q: 2, r: 0 })).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotPlayerControlled,
    });
    expect(session.selectedUnitId).toBeNull();

    expect(session.clickHex(playerAlly.position)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotPlayerControlled,
    });

    expect(session.previewHex({ q: 0, r: 0 })).toEqual({
      type: GameActionPreviewType.Selection,
      unitId: "player",
    });
    expect(session.clickHex({ q: 0, r: 0 })).toEqual({
      type: GameActionType.Selected,
      unitId: "player",
    });
    expect(session.previewHex(playerAlly.position)).toEqual({
      type: GameActionPreviewType.ServantCommandSelection,
      servantId: playerAlly.id,
    });
    expect(session.clickHex(playerAlly.position)).toEqual({
      type: GameActionType.ServantCommandTargetSelected,
      servantId: playerAlly.id,
    });
    expect(session.selectedUnitId).toBe("player");
    expect(session.servantCommandPresentation).toEqual({
      targetServantId: playerAlly.id,
      targetStrategyType: undefined,
      visiblePursuitTargetId: undefined,
      visibleSecureTargetHex: undefined,
      canAssignHold: true,
      canAssignPursue: true,
      canAssignSecure: true,
      canAssignProtect: true,
      canClearStrategy: false,
      targetSelection: undefined,
    });
    expect(session.clickHex({ q: 0, r: 0 })).toEqual({
      type: GameActionType.Deselected,
      unitId: "player",
    });
  });

  it("keeps presentation reads idempotent without changing tactical selection", () => {
    const { session, player, playerAlly, enemy } = createSession();
    session.clickHex(player.position);
    session.clickHex(playerAlly.position);

    const firstCommandPresentation = session.servantCommandPresentation;
    const firstQueuePresentation = session.initiativeQueuePresentation;
    const firstReachableHexes = session.getReachableHexes();
    const firstPreview = session.previewHex(enemy.position);

    expect(session.selectedUnitId).toBe(player.id);
    expect(session.servantCommandPresentation).toEqual(firstCommandPresentation);
    expect(session.initiativeQueuePresentation).toEqual(firstQueuePresentation);
    expect(session.getReachableHexes()).toEqual(firstReachableHexes);
    expect(session.previewHex(enemy.position)).toEqual(firstPreview);
    expect(session.timelinePresentation).toMatchObject({
      readyActorId: player.id,
      readyActorActionPoints: actionPointsPerActivation,
    });
  });

  it("reconciles a defeated selected Mage after the resolving state transition", () => {
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { currentHp: 20 },
    );
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([mage.position, enemy.position])),
      [mage, enemy],
    );

    session.clickHex(mage.position);
    session.waitForMage();

    expect(mage.isAlive).toBe(false);
    expect(session.selectedUnitId).toBeNull();
    expect(session.servantCommandPresentation.targetServantId).toBeUndefined();
    expect(session.getReachableHexes()).toEqual([]);
  });

  it("spends one AP for Protect Mage without ending the Mage activation", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: -1, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([mage.position, servant.position])),
      [mage, servant],
    );

    session.clickHex(mage.position);
    session.clickHex(servant.position);
    expect(session.assignProtectMageStrategy()).toEqual({
      type: GameActionType.StrategyAssigned,
      servantId: servant.id,
      strategyType: ServantStrategyType.ProtectMage,
    });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: mage.id,
      readyActorActionPoints: actionPointsPerActivation
        - TacticalActionPointCost.ServantStrategyCommand,
    });
    expect(session.selectedUnitId).toBe(mage.id);

    expect(session.servantCommandPresentation).toMatchObject({
      targetServantId: servant.id,
      targetStrategyType: ServantStrategyType.ProtectMage,
      canAssignHold: true,
      canAssignPursue: true,
      canAssignSecure: true,
      canAssignProtect: false,
      canClearStrategy: true,
    });
    expect(session.assignProtectMageStrategy()).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.StrategyUnchanged,
    });
    expect(session.timelinePresentation.readyActorActionPoints).toBe(
      actionPointsPerActivation - TacticalActionPointCost.ServantStrategyCommand,
    );
  });

  it("has a Protect Mage servant attack an adjacent perceived threat near the Mage", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 1 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([mage.position, servant.position, enemy.position])),
      [mage, servant, enemy],
    );

    session.clickHex(mage.position);
    session.clickHex(servant.position);
    session.assignProtectMageStrategy();
    session.waitForMage();

    expect(enemy.currentHp).toBe(enemy.maxHp - servant.attackPower * 2);
    expect(servant.position).toEqual({ q: 0, r: 1 });
  });

  it("moves a Protect Mage servant to the closest legal position near the Mage", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: -3, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        mage.position,
        { q: -1, r: 0 },
        { q: -2, r: 0 },
        servant.position,
      ])),
      [mage, servant],
    );

    session.clickHex(mage.position);
    session.clickHex(servant.position);
    session.assignProtectMageStrategy();
    session.waitForMage();

    expect(servant.position).toEqual({ q: -1, r: 0 });
  });

  it("moves a Protect Mage servant toward a reachable attack position for a threat", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: -1, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const enemy = new Unit(
      "enemy",
      { q: 2, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        mage.position,
        servant.position,
        { q: 1, r: 0 },
        { q: -1, r: 1 },
        { q: 0, r: 1 },
        { q: 1, r: 1 },
        enemy.position,
      ])),
      [mage, servant, enemy],
    );

    session.clickHex(mage.position);
    session.clickHex(servant.position);
    session.assignProtectMageStrategy();
    session.waitForMage();

    expect(servant.position).toEqual({ q: 1, r: 1 });
    expect(enemy.currentHp).toBe(enemy.maxHp);
  });

  it("clears Protect Mage when the Mage dies", () => {
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { currentHp: 20 },
    );
    const servant = new Unit(
      "servant",
      { q: -1, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([mage.position, servant.position, enemy.position])),
      [mage, servant, enemy],
    );

    session.clickHex(mage.position);
    session.clickHex(servant.position);
    session.assignProtectMageStrategy();
    session.waitForMage();

    expect(mage.isAlive).toBe(false);
    expect(session.getServantStrategyType(servant.id)).toBeUndefined();
  });

  it("spends Mage AP before ending its activation and allows one deferral", () => {
    const { session, player } = createSession();
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: player.id,
    });
    session.clickHex({ q: 0, r: 0 });

    expect(session.previewHex({ q: 0, r: -1 })).toEqual({
      type: GameActionPreviewType.ValidMove,
      unitId: "player",
      destination: { q: 0, r: -1 },
      path: {
        cost: 1,
        steps: [{ q: 0, r: -1 }],
      },
    });
    expect(session.getReachableHexes()).toEqual(
      expect.arrayContaining([{ coord: { q: 0, r: -3 }, cost: 3 }]),
    );

    expect(session.clickHex({ q: 0, r: -1 })).toEqual({
      type: GameActionType.Moved,
      unitId: "player",
      from: { q: 0, r: 0 },
      to: { q: 0, r: -1 },
    });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(0);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: player.id,
      readyActorActionPoints: actionPointsPerActivation - TacticalActionPointCost.Move,
    });
    expect(session.getReachableHexes().every(
      (reachableHex) => reachableHex.cost <= actionPointsPerActivation
        - TacticalActionPointCost.Move,
    )).toBe(true);
    expect(session.previewHex({ q: 0, r: -2 })).toMatchObject({
      type: GameActionPreviewType.ValidMove,
      destination: { q: 0, r: -2 },
    });

    session.clickHex({ q: 0, r: -3 });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: player.id,
      readyActorActionPoints: TacticalActionPointCost.Move,
    });
    session.endMageTurn();
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(baseTimelineRecoveryDelay);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: baseTimelineRecoveryDelay,
      readyActorId: player.id,
      readyActorActionPoints: actionPointsPerActivation,
    });

    expect(session.waitForMage()).toEqual({
      type: GameActionType.Waited,
      unitId: player.id,
    });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(baseTimelineRecoveryDelay);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: baseTimelineRecoveryDelay,
      readyActorId: player.id,
      readyActorHasWaited: true,
    });

    expect(session.waitForMage()).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotReady,
    });

    expect(session.endMageTurn()).toEqual({
      type: GameActionType.TurnEnded,
      unitId: player.id,
    });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: baseTimelineRecoveryDelay * 2,
      readyActorId: player.id,
      readyActorHasWaited: false,
    });
  });

  it("ends the ready Mage activation without requiring a prior Wait", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const session = new GameSession(new GameMap(mapData), [mage]);

    expect(session.endMageTurn()).toEqual({
      type: GameActionType.TurnEnded,
      unitId: mage.id,
    });
    expect(session.timelinePresentation).toEqual({
      currentTime: baseTimelineRecoveryDelay,
      readyActorId: mage.id,
      readyActorActionPoints: actionPointsPerActivation,
      actionPointsPerActivation,
      readyActorHasWaited: false,
      readyActorRecoveryDelay: baseTimelineRecoveryDelay,
    });
  });

  it("delays a Mage-issued Hold strategy until the servant's own activation", () => {
    const { session, player, playerAlly } = createSession();
    session.clickHex(player.position);
    session.clickHex(playerAlly.position);
    const servantNextReadyAt = session.eventTimeline.getNextReadyAt(playerAlly.id);

    expect(session.assignHoldStrategy()).toEqual({
      type: GameActionType.StrategyAssigned,
      servantId: playerAlly.id,
      strategyType: ServantStrategyType.Hold,
    });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(0);
    expect(session.eventTimeline.getNextReadyAt(playerAlly.id)).toBe(servantNextReadyAt);
    expect(session.selectedUnitId).toBe(player.id);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: player.id,
      readyActorActionPoints: actionPointsPerActivation
        - TacticalActionPointCost.ServantStrategyCommand,
    });

    session.waitForMage();
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: player.id,
      readyActorHasWaited: true,
    });
    expect(session.selectedUnitId).toBe(player.id);
    expect(session.eventTimeline.getNextReadyAt(playerAlly.id)).toBe(100);
  });

  it("assigns an explicit visible Enemy pursuit without charging an unchanged order", () => {
    const { session, player, playerAlly, enemy } = createSession();
    session.clickHex(player.position);
    session.clickHex(playerAlly.position);
    const initialMageReadyAt = session.eventTimeline.getNextReadyAt(player.id);

    expect(session.beginPursueDesignatedEnemySelection()).toEqual({
      type: GameActionType.PursuitTargetSelectionStarted,
      servantId: playerAlly.id,
    });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(initialMageReadyAt);
    expect(session.previewHex(enemy.position)).toEqual({
      type: GameActionPreviewType.PursuitTargetSelection,
      servantId: playerAlly.id,
      targetId: enemy.id,
    });
    expect(session.clickHex(enemy.position)).toEqual({
      type: GameActionType.StrategyAssigned,
      servantId: playerAlly.id,
      strategyType: ServantStrategyType.PursueDesignatedEnemy,
      targetId: enemy.id,
    });
    expect(session.selectedUnitId).toBe(player.id);
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(0);
    expect(session.timelinePresentation.readyActorActionPoints).toBe(
      actionPointsPerActivation - TacticalActionPointCost.ServantStrategyCommand,
    );

    const readyAtAfterAssignment = session.eventTimeline.getNextReadyAt(player.id);
    expect(session.assignPursueDesignatedEnemyStrategyToServant(
      playerAlly.id,
      enemy.id,
    )).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.StrategyUnchanged,
    });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(
      readyAtAfterAssignment,
    );
  });

  it("rejects a hidden or non-Enemy pursuit target without spending Mage Tempo", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      viewRange: 1,
    });
    const servant = new Unit(
      "servant",
      { q: -1, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const neutral = new Unit(
      "neutral",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Neutral },
    );
    const hiddenEnemy = new Unit(
      "hidden-enemy",
      { q: 2, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
      ])),
      [mage, servant, neutral, hiddenEnemy],
    );
    session.clickHex(mage.position);
    session.clickHex(servant.position);
    session.beginPursueDesignatedEnemySelection();
    const mageReadyAt = session.eventTimeline.getNextReadyAt(mage.id);

    expect(session.previewHex(neutral.position)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.InvalidEnemyTarget,
    });
    expect(session.clickHex(neutral.position)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.InvalidEnemyTarget,
    });
    expect(session.previewHex(hiddenEnemy.position)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.NotVisible,
    });
    expect(session.clickHex(hiddenEnemy.position)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotVisible,
    });
    expect(session.clearServantStrategy()).toEqual({
      type: GameActionType.PursuitTargetSelectionCancelled,
      servantId: servant.id,
    });
    expect(session.eventTimeline.getNextReadyAt(mage.id)).toBe(mageReadyAt);
  });

  it("holds a visible Secure order when its target fits in one activation", () => {
    const mage = new Player("mage", { q: 0, r: -1 }, UnitTexture.PlayerIdle, {
      viewRange: 3,
    });
    const servant = new Unit(
      "servant",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const targetHex = { q: 2, r: 0 };
    const hiddenHex = { q: 3, r: 0 };
    const session = new GameSession(
      new GameMap(createGrassMap([
        mage.position,
        servant.position,
        { q: 1, r: 0 },
        targetHex,
        hiddenHex,
      ])),
      [mage, servant],
    );
    session.clickHex(mage.position);
    session.clickHex(servant.position);
    const mageReadyAt = session.eventTimeline.getNextReadyAt(mage.id);
    if (mageReadyAt === undefined) {
      throw new Error("Mage must have a scheduled timeline activation");
    }

    expect(session.beginSecureDesignatedHexSelection()).toEqual({
      type: GameActionType.SecureTargetSelectionStarted,
      servantId: servant.id,
    });
    expect(session.previewHex(targetHex)).toEqual({
      type: GameActionPreviewType.SecureTargetSelection,
      servantId: servant.id,
      targetHex,
    });
    expect(session.previewHex(hiddenHex)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.NotVisible,
    });
    expect(session.clickHex(hiddenHex)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotVisible,
    });
    expect(session.eventTimeline.getNextReadyAt(mage.id)).toBe(mageReadyAt);
    expect(session.previewHex({ q: 9, r: 9 })).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.MissingField,
    });
    expect(session.clickHex(targetHex)).toEqual({
      type: GameActionType.StrategyAssigned,
      servantId: servant.id,
      strategyType: ServantStrategyType.SecureDesignatedHex,
      targetHex,
    });
    expect(session.eventTimeline.getNextReadyAt(mage.id)).toBe(mageReadyAt);
    expect(session.timelinePresentation.readyActorActionPoints).toBe(
      actionPointsPerActivation - TacticalActionPointCost.ServantStrategyCommand,
    );

    session.waitForMage();
    expect(servant.position).toEqual(targetHex);

    expect(session.clickHex(servant.position)).toEqual({
      type: GameActionType.ServantCommandTargetSelected,
      servantId: servant.id,
    });
    expect(session.servantCommandPresentation).toMatchObject({
      targetStrategyType: ServantStrategyType.SecureDesignatedHex,
      visibleSecureTargetHex: targetHex,
    });
  });

  it("holds the assigned Secure hex instead of pursuing a distant hostile", () => {
    const mage = new Player("mage", { q: 0, r: -1 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const targetHex = { q: 2, r: 0 };
    const distantEnemy = new Unit(
      "distant-enemy",
      { q: 5, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy, viewRange: 1 },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        mage.position,
        servant.position,
        { q: 1, r: 0 },
        targetHex,
        { q: 3, r: 0 },
        { q: 4, r: 0 },
        distantEnemy.position,
      ])),
      [mage, servant, distantEnemy],
    );

    expect(session.assignSecureDesignatedHexStrategyToServant(
      servant.id,
      targetHex,
    )).toMatchObject({
      type: GameActionType.StrategyAssigned,
      strategyType: ServantStrategyType.SecureDesignatedHex,
    });
    session.waitForMage();
    expect(servant.position).toEqual(targetHex);

    session.endMageTurn();
    expect(servant.position).toEqual(targetHex);

    expect(session.clickHex(mage.position)).toEqual({
      type: GameActionType.Selected,
      unitId: mage.id,
    });
    expect(session.clickHex(servant.position)).toEqual({
      type: GameActionType.ServantCommandTargetSelected,
      servantId: servant.id,
    });
    expect(session.servantCommandPresentation).toMatchObject({
      targetStrategyType: ServantStrategyType.SecureDesignatedHex,
      visibleSecureTargetHex: targetHex,
    });
  });

  it("attacks only a hostile occupant while approaching a Secure hex", () => {
    const mage = new Player("mage", { q: 0, r: -1 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const hostile = new Unit(
      "hostile",
      { q: 2, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy, viewRange: 1 },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        mage.position,
        servant.position,
        { q: 1, r: 0 },
        hostile.position,
      ])),
      [mage, servant, hostile],
    );

    session.assignSecureDesignatedHexStrategyToServant(
      servant.id,
      hostile.position,
    );
    session.waitForMage();
    expect(servant.position).toEqual({ q: 1, r: 0 });
    expect(hostile.currentHp).toBe(hostile.maxHp - servant.attackPower);

    session.endMageTurn();
    session.waitForMage();
    expect(hostile.currentHp).toBe(hostile.maxHp - servant.attackPower * 3);
    expect(servant.position).toEqual({ q: 1, r: 0 });
  });

  it("approaches but does not attack a non-hostile Secure-hex occupant", () => {
    const mage = new Player("mage", { q: 0, r: -1 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const neutral = new Unit(
      "neutral",
      { q: 2, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Neutral },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        mage.position,
        servant.position,
        { q: 1, r: 0 },
        neutral.position,
      ])),
      [mage, servant, neutral],
    );

    session.assignSecureDesignatedHexStrategyToServant(
      servant.id,
      neutral.position,
    );
    session.waitForMage();
    expect(servant.position).toEqual({ q: 1, r: 0 });

    session.endMageTurn();
    expect(neutral.currentHp).toBe(neutral.maxHp);
    expect(servant.position).toEqual({ q: 1, r: 0 });
  });

  it("keeps a Secure order private when its target leaves Mage sight", () => {
    const mage = new Player("mage", { q: 0, r: -1 }, UnitTexture.PlayerIdle, {
      viewRange: 3,
    });
    const servant = new Unit(
      "servant",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const neutral = new Unit(
      "neutral",
      { q: 2, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Neutral },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: 0, r: -2 },
        mage.position,
        servant.position,
        { q: 1, r: 0 },
        neutral.position,
      ])),
      [mage, servant, neutral],
    );

    session.assignSecureDesignatedHexStrategyToServant(
      servant.id,
      neutral.position,
    );
    session.resolveAutonomousActivations();

    session.clickHex(mage.position);
    session.clickHex({ q: 0, r: -2 });
    expect(session.getFieldVisibility(neutral.position)).toBe(
      FieldVisibility.Discovered,
    );
    expect(session.clickHex(servant.position)).toEqual({
      type: GameActionType.ServantCommandTargetSelected,
      servantId: servant.id,
    });
    expect(session.servantCommandPresentation).toMatchObject({
      targetStrategyType: ServantStrategyType.SecureDesignatedHex,
      visibleSecureTargetHex: undefined,
    });
  });

  it("replaces a pursuit strategy only when a different valid Enemy is designated", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: -1, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const firstEnemy = new Unit(
      "enemy-a",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const replacementEnemy = new Unit(
      "enemy-b",
      { q: 0, r: 1 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
      ])),
      [mage, servant, firstEnemy, replacementEnemy],
    );

    expect(session.assignPursueDesignatedEnemyStrategyToServant(
      servant.id,
      firstEnemy.id,
    )).toMatchObject({
      type: GameActionType.StrategyAssigned,
      targetId: firstEnemy.id,
    });
    session.resolveAutonomousActivations();
    expect(session.assignPursueDesignatedEnemyStrategyToServant(
      servant.id,
      replacementEnemy.id,
    )).toEqual({
      type: GameActionType.StrategyAssigned,
      servantId: servant.id,
      strategyType: ServantStrategyType.PursueDesignatedEnemy,
      targetId: replacementEnemy.id,
    });
  });

  it("moves a pursuing servant and uses its remaining AP on a legal attack", () => {
    const mage = new Player("mage", { q: 0, r: -1 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const enemy = new Unit(
      "enemy",
      { q: 3, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: 0, r: -1 },
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 },
      ])),
      [mage, servant, enemy],
    );

    session.clickHex(mage.position);
    session.clickHex(servant.position);
    expect(session.assignPursueDesignatedEnemyStrategyToServant(
      servant.id,
      enemy.id,
    )).toMatchObject({
      type: GameActionType.StrategyAssigned,
      targetId: enemy.id,
    });
    expect(session.timelinePresentation).toMatchObject({
      readyActorId: mage.id,
      readyActorActionPoints: actionPointsPerActivation
        - TacticalActionPointCost.ServantStrategyCommand,
    });
    session.waitForMage();

    expect(servant.position).toEqual({ q: 2, r: 0 });
    expect(enemy.currentHp).toBe(enemy.maxHp - servant.attackPower);
    expect(session.eventTimeline.getNextReadyAt(servant.id)).toBe(
      baseTimelineRecoveryDelay,
    );

    session.endMageTurn();
    session.waitForMage();

    expect(enemy.currentHp).toBe(enemy.maxHp - servant.attackPower * 3);
    expect(session.eventTimeline.getNextReadyAt(servant.id)).toBe(
      baseTimelineRecoveryDelay * 2,
    );
  });

  it("keeps pursuing a designated Enemy after the Enemy leaves Mage sight", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      viewRange: 1,
    });
    const servant = new Unit(
      "servant",
      { q: -1, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy, viewRange: 1 },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: -1, r: 0 },
        { q: 0, r: -2 },
        { q: 0, r: -1 },
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ])),
      [mage, servant, enemy],
    );
    session.clickHex(mage.position);
    session.clickHex(servant.position);
    expect(session.assignPursueDesignatedEnemyStrategyToServant(
      servant.id,
      enemy.id,
    )).toMatchObject({
      type: GameActionType.StrategyAssigned,
      targetId: enemy.id,
    });
    session.clickHex({ q: 0, r: -2 });
    expect(session.isUnitVisible(enemy)).toBe(false);
    expect(session.servantCommandPresentation.visiblePursuitTargetId).toBeUndefined();

    session.endMageTurn();

    expect(servant.position).toEqual({ q: 0, r: 0 });
    expect(enemy.currentHp).toBe(enemy.maxHp - servant.attackPower);
  });

  it("clears every pursuit order when its designated Enemy dies", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: -1, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy, currentHp: 20 },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ])),
      [mage, servant, enemy],
    );
    session.clickHex(mage.position);
    session.clickHex(servant.position);
    session.assignPursueDesignatedEnemyStrategyToServant(servant.id, enemy.id);
    session.waitForMage();

    expect(session.clickHex(enemy.position)).toMatchObject({
      type: GameActionType.Attacked,
      targetId: enemy.id,
      targetDefeated: true,
    });
    expect(enemy.isAlive).toBe(false);

    expect(session.clickHex(servant.position)).toEqual({
      type: GameActionType.ServantCommandTargetSelected,
      servantId: servant.id,
    });
    expect(session.servantCommandPresentation).toMatchObject({
      targetStrategyType: undefined,
      visiblePursuitTargetId: undefined,
    });
  });

  it("keeps an unordered servant adjacent to the Mage without overlap", () => {
    const player = new Player("player", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const playerAlly = new Unit(
      "player-ally",
      { q: -1, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([player.position, playerAlly.position])),
      [player, playerAlly],
    );

    expect(session.waitForMage()).toEqual({
      type: GameActionType.Waited,
      unitId: player.id,
    });
    expect(session.eventTimeline.getNextReadyAt(playerAlly.id)).toBe(
      baseTimelineRecoveryDelay,
    );
    expect(playerAlly.position).toEqual({ q: -1, r: 0 });
    expect(playerAlly.position).not.toEqual(player.position);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: player.id,
      readyActorHasWaited: true,
    });
  });

  it("runs unordered servant following only during its timeline activation", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: -3, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        servant.position,
        { q: -2, r: 0 },
        { q: -1, r: 0 },
        mage.position,
      ])),
      [mage, servant],
    );

    expect(session.timelinePresentation.readyActorId).toBe(mage.id);
    expect(session.timelinePresentation.readyActorId).toBe(mage.id);
    expect(servant.position).toEqual({ q: -3, r: 0 });

    expect(session.waitForMage()).toEqual({
      type: GameActionType.Waited,
      unitId: mage.id,
    });

    expect(servant.position).toEqual({ q: -1, r: 0 });
    expect(servant.position).not.toEqual(mage.position);
    expect(session.eventTimeline.getNextReadyAt(servant.id)).toBe(
      baseTimelineRecoveryDelay,
    );
  });

  it("has an unordered servant engage the first perceived hostile deterministically", () => {
    const mage = new Player("mage", { q: -1, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const firstEnemy = new Unit(
      "first-enemy",
      { q: 2, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const secondEnemy = new Unit(
      "second-enemy",
      { q: 1, r: -1 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        mage.position,
        servant.position,
        { q: 1, r: 0 },
        firstEnemy.position,
        secondEnemy.position,
      ])),
      [mage, servant, firstEnemy, secondEnemy],
    );

    session.waitForMage();

    expect(servant.position).toEqual({ q: 1, r: 0 });
    expect(firstEnemy.currentHp).toBe(firstEnemy.maxHp - servant.attackPower);
    expect(secondEnemy.currentHp).toBe(secondEnemy.maxHp);
  });

  it("clears a defeated default target before acquiring the next perceived hostile", () => {
    const mage = new Player("mage", { q: -1, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const defeatedTarget = new Unit(
      "defeated-target",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy, currentHp: 20 },
    );
    const replacementTarget = new Unit(
      "replacement-target",
      { q: 3, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        mage.position,
        servant.position,
        defeatedTarget.position,
        { q: 2, r: 0 },
        replacementTarget.position,
      ])),
      [mage, servant, defeatedTarget, replacementTarget],
    );

    session.waitForMage();

    expect(defeatedTarget.isAlive).toBe(false);
    expect(servant.position).toEqual({ q: 2, r: 0 });
  });

  it("keeps an explicit Hold order from pursuing while defending against an adjacent hostile", () => {
    const mage = new Player("mage", { q: -1, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([mage.position, servant.position, enemy.position])),
      [mage, servant, enemy],
    );

    expect(session.assignHoldStrategyToServant(servant.id)).toMatchObject({
      type: GameActionType.StrategyAssigned,
      strategyType: ServantStrategyType.Hold,
    });
    session.waitForMage();

    expect(servant.position).toEqual({ q: 0, r: 0 });
    expect(enemy.currentHp).toBe(enemy.maxHp - servant.attackPower * 2);
  });

  it("spends one AP for each changed or cleared visible servant strategy", () => {
    const { session, player, playerAlly } = createSession();
    const initialMageNextReadyAt = session.eventTimeline.getNextReadyAt(player.id);
    if (initialMageNextReadyAt === undefined) {
      throw new Error("Mage must have an initial timeline activation");
    }

    expect(session.clearServantStrategyFromServant(playerAlly.id)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NoActiveStrategy,
    });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(initialMageNextReadyAt);

    expect(session.assignHoldStrategyToServant(playerAlly.id)).toMatchObject({
      type: GameActionType.StrategyAssigned,
      servantId: playerAlly.id,
    });
    expect(session.timelinePresentation.readyActorActionPoints).toBe(
      actionPointsPerActivation - TacticalActionPointCost.ServantStrategyCommand,
    );
    expect(session.assignHoldStrategyToServant(playerAlly.id)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.StrategyUnchanged,
    });
    expect(session.assignProtectMageStrategyToServant(playerAlly.id)).toMatchObject({
      type: GameActionType.StrategyAssigned,
      servantId: playerAlly.id,
    });
    expect(session.timelinePresentation.readyActorActionPoints).toBe(
      actionPointsPerActivation - TacticalActionPointCost.ServantStrategyCommand * 2,
    );
    expect(session.clearServantStrategyFromServant(playerAlly.id)).toEqual({
      type: GameActionType.StrategyCleared,
      servantId: playerAlly.id,
    });
    expect(session.timelinePresentation.readyActorActionPoints).toBe(
      TacticalActionPointCost.Move,
    );
    session.endMageTurn();
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(
      initialMageNextReadyAt + baseTimelineRecoveryDelay,
    );
  });

  it("rejects hidden, defeated, and non-player servants without spending Mage Tempo", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      viewRange: 1,
    });
    const servant = new Unit("servant", { q: -1, r: 0 }, UnitTexture.PlayerIdle, {
      faction: Faction.Player,
    });
    const enemy = new Unit("enemy", { q: 2, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(new GameMap(mapData), [mage, servant, enemy]);

    expect(session.assignHoldStrategyToServant(enemy.id)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotPlayerControlled,
    });
    expect(session.assignHoldStrategyToServant(servant.id)).toMatchObject({
      type: GameActionType.StrategyAssigned,
      servantId: servant.id,
    });
    session.resolveAutonomousActivations();
    session.clickHex(mage.position);
    session.clickHex({ q: 0, r: -2 });

    expect(session.getFieldVisibility(servant.position)).toBe(FieldVisibility.Discovered);
    const mageNextReadyAt = session.eventTimeline.getNextReadyAt(mage.id);
    expect(session.previewHex(servant.position)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.NotVisible,
    });
    expect(session.assignHoldStrategyToServant(servant.id)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotVisible,
    });
    expect(session.eventTimeline.getNextReadyAt(mage.id)).toBe(mageNextReadyAt);

    servant.receiveDamage(servant.maxHp);
    expect(session.assignHoldStrategyToServant(servant.id)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotPlayerControlled,
    });
  });

  it("rejects impassable Ground terrain and live-unit movement destinations", () => {
    const { session } = createSession();
    session.clickHex({ q: 0, r: 0 });

    expect(session.previewHex({ q: 0, r: 1 })).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.OutOfRange,
    });
    expect(session.clickHex({ q: 0, r: 1 })).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.OutOfRange,
    });
    expect(session.previewHex({ q: 3, r: 0 })).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.NotHostile,
    });
  });

  it("allows adjacent Mage attacks after movement and invalidates defeated units", () => {
    const { session, player, enemy, neutral } = createSession();
    enemy.receiveDamage(enemy.maxHp - player.attackPower);
    session.clickHex({ q: 0, r: 0 });
    session.clickHex({ q: 1, r: 0 });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: player.id,
      readyActorActionPoints: actionPointsPerActivation - TacticalActionPointCost.Move,
    });

    expect(session.previewHex({ q: 2, r: 0 })).toEqual({
      type: GameActionPreviewType.ValidAttack,
      attackerId: "player",
      targetId: "enemy",
    });
    expect(session.clickHex({ q: 2, r: 0 })).toEqual({
      type: GameActionType.Attacked,
      attackerId: "player",
      targetId: "enemy",
      damage: 20,
      targetCurrentHp: 0,
      targetDefeated: true,
    });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: player.id,
      readyActorActionPoints: actionPointsPerActivation
        - TacticalActionPointCost.Move
        - TacticalActionPointCost.Attack,
    });

    expect(enemy.isAlive).toBe(false);
    expect(session.getUnitAt({ q: 2, r: 0 })).toBeUndefined();
    expect(session.units).toContain(enemy);
    expect(neutral.isAlive).toBe(true);
    expect(session.eventTimeline.getNextReadyAt(enemy.id)).toBeUndefined();

    expect(session.previewHex({ q: 2, r: 0 })).toMatchObject({
      type: GameActionPreviewType.ValidMove,
      destination: { q: 2, r: 0 },
    });
  });

  it("allows an attack followed by a one-hex retreat in the same Mage activation", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const enemy = new Unit("enemy", { q: 1, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const retreatHex = { q: -1, r: 0 };
    const session = new GameSession(
      new GameMap(createGrassMap([retreatHex, mage.position, enemy.position])),
      [mage, enemy],
    );

    session.clickHex(mage.position);
    expect(session.clickHex(enemy.position)).toMatchObject({
      type: GameActionType.Attacked,
      targetId: enemy.id,
    });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: mage.id,
      readyActorActionPoints: actionPointsPerActivation
        - TacticalActionPointCost.Attack,
    });
    expect(session.previewHex(enemy.position)).toEqual({
      type: GameActionPreviewType.ValidAttack,
      attackerId: mage.id,
      targetId: enemy.id,
    });

    expect(session.clickHex(retreatHex)).toEqual({
      type: GameActionType.Moved,
      unitId: mage.id,
      from: { q: 0, r: 0 },
      to: retreatHex,
    });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: mage.id,
      readyActorActionPoints: actionPointsPerActivation
        - TacticalActionPointCost.Attack
        - TacticalActionPointCost.Move,
    });
  });

  it("pursues the nearest visible hostile with a deterministic local step", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 1 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player, viewRange: 1 },
    );
    const enemy = new Unit(
      "enemy",
      { q: 2, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: 0, r: 0 },
        { q: 0, r: 1 },
        { q: 1, r: 0 },
        { q: 1, r: 1 },
        { q: 2, r: 0 },
      ])),
      [mage, servant, enemy],
    );

    expect(session.waitForMage()).toEqual({
      type: GameActionType.Waited,
      unitId: mage.id,
    });

    expect(enemy.position).toEqual({ q: 1, r: 0 });
    expect(session.getEnemyLastKnownHostilePosition(enemy.id)).toEqual(
      mage.position,
    );
    expect(session.eventTimeline.getNextReadyAt(enemy.id)).toBe(
      baseTimelineRecoveryDelay,
    );
  });

  it("attacks an adjacent visible hostile twice during an Enemy activation", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([{ q: 0, r: 0 }, { q: 1, r: 0 }])),
      [mage, enemy],
    );

    session.waitForMage();

    expect(mage.currentHp).toBe(mage.maxHp - enemy.attackPower * 2);
    expect(enemy.position).toEqual({ q: 1, r: 0 });
    expect(session.eventTimeline.getNextReadyAt(enemy.id)).toBe(
      baseTimelineRecoveryDelay,
    );
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: mage.id,
      readyActorHasWaited: true,
    });
  });

  it("pursues a last known hostile position and clears memory on arrival", () => {
    const mage = new Player("mage", { q: 2, r: 0 }, UnitTexture.PlayerIdle);
    const enemy = new Unit(
      "enemy",
      { q: 3, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy, viewRange: 1 },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: 0, r: -1 },
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 },
      ])),
      [mage, enemy],
    );

    session.waitForMage();
    expect(mage.currentHp).toBe(mage.maxHp - enemy.attackPower * 2);
    expect(session.getEnemyLastKnownHostilePosition(enemy.id)).toEqual({
      q: 2,
      r: 0,
    });

    session.clickHex(mage.position);
    session.clickHex({ q: 0, r: -1 });

    session.endMageTurn();
    session.waitForMage();

    expect(enemy.position).toEqual({ q: 2, r: 0 });
    expect(session.getEnemyLastKnownHostilePosition(enemy.id)).toBeUndefined();
  });

  it("holds when no legal local step decreases the distance to a visible hostile", () => {
    const mage = new Player("mage", { q: -1, r: 0 }, UnitTexture.PlayerIdle);
    const blocker = new Unit(
      "blocker",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Neutral },
    );
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ])),
      [mage, blocker, enemy],
    );

    session.waitForMage();

    expect(enemy.position).toEqual({ q: 1, r: 0 });
    expect(session.getEnemyLastKnownHostilePosition(enemy.id)).toEqual({
      q: -1,
      r: 0,
    });
    expect(session.eventTimeline.getNextReadyAt(enemy.id)).toBe(
      baseTimelineRecoveryDelay,
    );
  });

  it("applies Might to melee damage and Finesse to Mage recovery time", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      attributes: {
        [TacticalAttribute.Might]: 12,
        [TacticalAttribute.Finesse]: 14,
      },
    });
    const enemy = new Unit("enemy", { q: 2, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(new GameMap(mapData), [mage, enemy]);

    expect(session.timelinePresentation).toMatchObject({
      readyActorActionPoints: actionPointsPerActivation,
      readyActorRecoveryDelay: 98,
    });

    session.clickHex(mage.position);
    session.clickHex({ q: 1, r: 0 });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorActionPoints: actionPointsPerActivation - TacticalActionPointCost.Move,
    });

    expect(session.clickHex(enemy.position)).toMatchObject({
      type: GameActionType.Attacked,
      damage: 22,
      targetCurrentHp: 78,
    });
    session.endMageTurn();
    expect(session.timelinePresentation.currentTime).toBe(98);
  });

  it("tracks Mage discovery after movement and rejects hidden unit selection", () => {
    const visibilityMap: MapArray = [0, 1, 2, 3].map((q) => ({
      q,
      r: 0,
      fieldAttrs: field(TerrainType.Grass),
    }));
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { viewRange: 1 },
    );
    const hiddenAlly = new Unit(
      "hidden-ally",
      { q: 3, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const session = new GameSession(
      new GameMap(visibilityMap),
      [mage, hiddenAlly],
    );

    expect(session.getFieldVisibility({ q: 0, r: 0 })).toBe(
      FieldVisibility.Visible,
    );
    expect(session.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Undiscovered,
    );
    expect(session.previewHex(hiddenAlly.position)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.NotVisible,
    });
    expect(session.clickHex(hiddenAlly.position)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotVisible,
    });

    session.clickHex(mage.position);
    session.clickHex({ q: 1, r: 0 });
    session.clickHex({ q: 2, r: 0 });

    expect(session.getFieldVisibility({ q: 0, r: 0 })).toBe(
      FieldVisibility.Discovered,
    );
    expect(session.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Visible,
    );
  });

  it("projects an undiscovered Enemy as an information-safe queue card", () => {
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { viewRange: 1 },
    );
    const hiddenEnemy = new Unit(
      "hidden-enemy",
      { q: 2, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
      ])),
      [mage, hiddenEnemy],
    );

    expect(session.initiativeQueuePresentation.entries).toEqual([
      {
        cardId: "unit-mage",
        state: InitiativeQueueCardState.Identified,
        label: InitiativeQueueActorLabel.Mage,
        unitId: mage.id,
        isCurrent: true,
        canHighlight: true,
      },
      {
        cardId: "unknown-1",
        state: InitiativeQueueCardState.Unknown,
        label: undefined,
        unitId: undefined,
        isCurrent: false,
        canHighlight: false,
      },
    ]);
    expect(session.getInitiativeQueueHighlightUnitId(hiddenEnemy.id)).toBeUndefined();
  });

  it("keeps a discovered but hidden Enemy identified without permitting a map highlight", () => {
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { viewRange: 1 },
    );
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );
    const session = new GameSession(
      new GameMap(createGrassMap([
        { q: -1, r: 0 },
        mage.position,
        enemy.position,
      ])),
      [mage, enemy],
    );

    expect(session.getInitiativeQueueHighlightUnitId(enemy.id)).toBe(enemy.id);
    session.clickHex(mage.position);
    session.clickHex({ q: -1, r: 0 });

    const enemyCard = session.initiativeQueuePresentation.entries.find(
      (entry) => entry.unitId === enemy.id,
    );
    expect(session.getFieldVisibility(enemy.position)).toBe(FieldVisibility.Discovered);
    expect(enemyCard).toEqual({
      cardId: "unit-enemy",
      state: InitiativeQueueCardState.Identified,
      label: InitiativeQueueActorLabel.Enemy,
      unitId: enemy.id,
      isCurrent: false,
      canHighlight: false,
    });
    expect(session.getInitiativeQueueHighlightUnitId(enemy.id)).toBeUndefined();
  });

  it("requires exactly one living Mage", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const secondMage = new Player(
      "second-mage",
      { q: 1, r: 0 },
      UnitTexture.PlayerIdle,
    );

    expect(() => new GameSession(
      new GameMap(mapData),
      [mage, secondMage],
    )).toThrow("A game session requires exactly one living Mage");
  });
});

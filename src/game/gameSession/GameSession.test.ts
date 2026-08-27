import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { Faction } from "@/game/faction/Faction";
import {
  GameActionPreviewType,
  GameActionRejectionReason,
  GameActionType,
  GameSession,
  InitiativeQueueActorLabel,
  InitiativeQueueCardState,
} from "@/game/gameSession/GameSession";
import {
  actionPointsPerActivation,
  baseTimelineRecoveryDelay,
  TacticalActionPointCost,
} from "@/game/eventTimeline/EventTimeline";
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

function field(terrainType: TerrainType, ground = true) {
  return {
    terrainType,
    allowedMovements: {
      [MovementType.Ground]: ground,
      [MovementType.Flying]: true,
    },
    groundLevel: 0,
    leavingCostMultiplier: 1,
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
  it("publishes ordered immutable paths after authoritative player movement", () => {
    const { session, player } = createSession();
    session.clickHex(player.position);

    expect(session.clickHex({ q: 0, r: -2 })).toMatchObject({
      type: GameActionType.Moved,
      unitId: player.id,
    });
    const events = session.consumeMovementEvents();
    expect(events).toEqual([
      {
        unitId: player.id,
        from: { q: 0, r: 0 },
        steps: [{ q: 0, r: -1 }, { q: 0, r: -2 }],
      },
    ]);
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(Object.isFrozen(events[0].from)).toBe(true);
    expect(Object.isFrozen(events[0].steps)).toBe(true);
    expect(player.position).toEqual({ q: 0, r: -2 });
    expect(session.consumeMovementEvents()).toEqual([]);
  });

  it("preserves autonomous movement event order independently of final state", () => {
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

    expect(session.consumeMovementEvents()).toEqual([
      {
        unitId: enemy.id,
        from: { q: 3, r: 0 },
        steps: [{ q: 2, r: 0 }],
      },
      {
        unitId: enemy.id,
        from: { q: 2, r: 0 },
        steps: [{ q: 1, r: 0 }],
      },
    ]);
    expect(enemy.position).toEqual({ q: 1, r: 0 });
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
      canClearStrategy: false,
      targetSelection: undefined,
    });
    expect(session.clickHex({ q: 0, r: 0 })).toEqual({
      type: GameActionType.Deselected,
      unitId: "player",
    });
  });

  it("spends Mage AP before applying one recovery delay and allows one deferral", () => {
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
      type: GameActionType.TurnEnded,
      unitId: player.id,
    });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: baseTimelineRecoveryDelay * 2,
      readyActorId: player.id,
      readyActorHasWaited: false,
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
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(baseTimelineRecoveryDelay);
    expect(session.eventTimeline.getNextReadyAt(playerAlly.id)).toBe(servantNextReadyAt);
    expect(session.selectedUnitId).toBe(player.id);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: playerAlly.id,
    });

    session.resolveAutonomousActivations();
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 100,
      readyActorId: player.id,
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
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(baseTimelineRecoveryDelay);

    session.resolveAutonomousActivations();
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
    expect(session.eventTimeline.getNextReadyAt(mage.id)).toBe(
      mageReadyAt + baseTimelineRecoveryDelay,
    );

    session.resolveAutonomousActivations();
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
    session.resolveAutonomousActivations();
    expect(servant.position).toEqual(targetHex);

    session.waitForMage();
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
    session.resolveAutonomousActivations();
    expect(servant.position).toEqual({ q: 1, r: 0 });
    expect(hostile.currentHp).toBe(hostile.maxHp - servant.attackPower);

    session.waitForMage();
    expect(hostile.currentHp).toBe(hostile.maxHp - servant.attackPower * 2);
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
    session.resolveAutonomousActivations();
    expect(servant.position).toEqual({ q: 1, r: 0 });

    session.waitForMage();
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

  it("moves a pursuing servant until its remaining AP cannot fund an attack", () => {
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
    expect(session.timelinePresentation.readyActorId).toBe(servant.id);
    session.resolveAutonomousActivations();

    expect(servant.position).toEqual({ q: 2, r: 0 });
    expect(enemy.currentHp).toBe(enemy.maxHp);
    expect(session.eventTimeline.getNextReadyAt(servant.id)).toBe(
      baseTimelineRecoveryDelay,
    );

    session.waitForMage();

    expect(enemy.currentHp).toBe(enemy.maxHp - servant.attackPower);
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
    session.resolveAutonomousActivations();

    session.clickHex({ q: 0, r: -2 });
    expect(session.isUnitVisible(enemy)).toBe(false);
    expect(session.servantCommandPresentation.visiblePursuitTargetId).toBeUndefined();

    session.waitForMage();

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
    session.resolveAutonomousActivations();

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

  it("holds an unordered servant without spending AP when no hostile is perceived", () => {
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
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: player.id,
      readyActorHasWaited: true,
    });
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
    expect(servant.position).toEqual({ q: 1, r: 0 });
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
    session.resolveAutonomousActivations();

    expect(servant.position).toEqual({ q: 0, r: 0 });
    expect(enemy.currentHp).toBe(enemy.maxHp - servant.attackPower);
  });

  it("allows a visible strategy to be replaced or cleared only by a ready Mage", () => {
    const { session, player, playerAlly } = createSession();
    const initialMageNextReadyAt = session.eventTimeline.getNextReadyAt(player.id);

    expect(session.clearServantStrategyFromServant(playerAlly.id)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NoActiveStrategy,
    });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(initialMageNextReadyAt);

    expect(session.assignHoldStrategyToServant(playerAlly.id)).toMatchObject({
      type: GameActionType.StrategyAssigned,
      servantId: playerAlly.id,
    });
    expect(session.assignHoldStrategyToServant(playerAlly.id)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotReady,
    });
    session.resolveAutonomousActivations();

    expect(session.assignHoldStrategyToServant(playerAlly.id)).toMatchObject({
      type: GameActionType.StrategyAssigned,
      servantId: playerAlly.id,
    });
    session.resolveAutonomousActivations();
    expect(session.clearServantStrategyFromServant(playerAlly.id)).toEqual({
      type: GameActionType.StrategyCleared,
      servantId: playerAlly.id,
    });
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
      targetCurrentHp: 80,
      targetDefeated: false,
    });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(
      baseTimelineRecoveryDelay,
    );
    expect(session.timelinePresentation).toMatchObject({
      currentTime: baseTimelineRecoveryDelay,
      readyActorId: player.id,
    });

    for (let health = 60; health >= 0; health -= 20) {
      expect(session.clickHex({ q: 2, r: 0 })).toMatchObject({
        type: GameActionType.Attacked,
        targetCurrentHp: health,
        targetDefeated: health === 0,
      });
      if (health > 0) {
        session.waitForMage();
        session.waitForMage();
      }
    }

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
      readyActorActionPoints: TacticalActionPointCost.Move,
    });
    expect(session.previewHex(enemy.position)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.InsufficientActionPoints,
    });

    expect(session.clickHex(retreatHex)).toEqual({
      type: GameActionType.Moved,
      unitId: mage.id,
      from: { q: 0, r: 0 },
      to: retreatHex,
    });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: baseTimelineRecoveryDelay,
      readyActorId: mage.id,
      readyActorActionPoints: actionPointsPerActivation,
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

  it("attacks an adjacent visible hostile once during an Enemy activation", () => {
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

    expect(mage.currentHp).toBe(mage.maxHp - enemy.attackPower);
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
    expect(mage.currentHp).toBe(mage.maxHp - enemy.attackPower);
    expect(session.getEnemyLastKnownHostilePosition(enemy.id)).toEqual({
      q: 2,
      r: 0,
    });

    session.clickHex(mage.position);
    session.clickHex({ q: 0, r: -1 });

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

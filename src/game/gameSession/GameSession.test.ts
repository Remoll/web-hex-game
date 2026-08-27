import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { Faction } from "@/game/faction/Faction";
import {
  GameActionPreviewType,
  GameActionRejectionReason,
  GameActionType,
  GameSession,
} from "@/game/gameSession/GameSession";
import {
  TimelineAction,
  timelineActionCosts,
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
      canAssignHold: true,
      canClearStrategy: false,
    });
    expect(session.clickHex({ q: 0, r: 0 })).toEqual({
      type: GameActionType.Deselected,
      unitId: "player",
    });
  });

  it("schedules Mage movement and waiting on the discrete event timeline", () => {
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
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(100);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 100,
      readyActorId: player.id,
    });
    expect(session.previewHex({ q: 0, r: -2 })).toMatchObject({
      type: GameActionPreviewType.ValidMove,
      destination: { q: 0, r: -2 },
    });

    session.clickHex({ q: 0, r: -3 });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(200);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 200,
      readyActorId: player.id,
    });

    expect(session.waitForMage()).toEqual({
      type: GameActionType.Waited,
      unitId: player.id,
    });
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(300);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 300,
      readyActorId: player.id,
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
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(
      timelineActionCosts[TimelineAction.Command],
    );
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

  it("resolves an unordered servant as a single autonomous Hold activation", () => {
    const { session, player, playerAlly } = createSession();

    expect(session.waitForMage()).toEqual({
      type: GameActionType.Waited,
      unitId: player.id,
    });
    expect(session.eventTimeline.getNextReadyAt(playerAlly.id)).toBe(
      timelineActionCosts[TimelineAction.Wait],
    );
    expect(session.timelinePresentation).toMatchObject({
      currentTime: timelineActionCosts[TimelineAction.Wait],
      readyActorId: player.id,
    });
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
      currentTime: 100,
      readyActorId: player.id,
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
    expect(session.eventTimeline.getNextReadyAt(player.id)).toBe(240);
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 240,
      readyActorId: player.id,
    });

    for (let health = 60; health >= 0; health -= 20) {
      expect(session.clickHex({ q: 2, r: 0 })).toMatchObject({
        type: GameActionType.Attacked,
        targetCurrentHp: health,
        targetDefeated: health === 0,
      });
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

  it("pursues the nearest visible hostile with a deterministic local step", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit(
      "servant",
      { q: 0, r: 1 },
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
      timelineActionCosts[TimelineAction.Move],
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
      timelineActionCosts[TimelineAction.Attack],
    );
    expect(session.timelinePresentation).toMatchObject({
      currentTime: timelineActionCosts[TimelineAction.Wait],
      readyActorId: mage.id,
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

    expect(enemy.position).toEqual({ q: 2, r: 0 });
    expect(session.getEnemyLastKnownHostilePosition(enemy.id)).toEqual({
      q: 2,
      r: 0,
    });

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
      timelineActionCosts[TimelineAction.Wait],
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

    expect(session.timelinePresentation.actionCosts).toMatchObject({
      [TimelineAction.Move]: 98,
      [TimelineAction.Attack]: 137,
      [TimelineAction.Wait]: 98,
    });

    session.clickHex(mage.position);
    session.clickHex({ q: 1, r: 0 });
    expect(session.timelinePresentation.currentTime).toBe(98);

    expect(session.clickHex(enemy.position)).toMatchObject({
      type: GameActionType.Attacked,
      damage: 22,
      targetCurrentHp: 78,
    });
    expect(session.timelinePresentation.currentTime).toBe(235);
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

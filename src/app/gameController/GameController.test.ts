import { describe, expect, it, vi } from "vitest";
import {
  GameController,
  type InitiativeQueuePresenter,
  type ServantCommandPresenter,
  type TacticalFeedbackPresenter,
  type TacticalPresentationPresenter,
  type TimelinePresenter,
} from "@/app/gameController/GameController";
import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  GameActionType,
  GameActionPreviewType,
  GameActionRejectionReason,
  GameSession,
  ServantStrategyTargetSelection,
  TacticalPresentationEventKind,
} from "@/game/gameSession/GameSession";
import {
  actionPointsPerActivation,
  baseTimelineRecoveryDelay,
  TacticalActionPointCost,
} from "@/game/eventTimeline/EventTimeline";
import { Faction } from "@/game/faction/Faction";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
import { ServantStrategyType } from "@/game/unit/servantStrategy/ServantStrategy";
import { TacticalHighlightKind } from "@/rendering/mapHighlightView/MapHighlightRenderModel";
import { MovementType, TerrainType, type MapArray } from "@/game/types";

const mapData: MapArray = [
  {
    q: 0,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
  {
    q: 1,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
];

const pursuitMapData: MapArray = [
  ...mapData,
  {
    q: 2,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
];

function createTacticalPresentationPresenter(): TacticalPresentationPresenter {
  return {
    isAnimating: false,
    sync: vi.fn(),
  };
}

describe("GameController", () => {
  it("syncs and safely clears an initiative-queue map highlight", () => {
    const player = new Player(
      "player",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
    );
    const session = new GameSession(new GameMap(mapData), [player]);
    const feedbackPresenter: TacticalFeedbackPresenter = { sync: vi.fn() };
    const queuePresenter: InitiativeQueuePresenter = { sync: vi.fn() };
    const controller = new GameController(
      session,
      createTacticalPresentationPresenter(),
      feedbackPresenter,
      undefined,
      undefined,
      queuePresenter,
    );

    expect(queuePresenter.sync).toHaveBeenLastCalledWith(
      session.initiativeQueuePresentation,
    );

    controller.highlightInitiativeQueueUnit(player.id);
    expect(feedbackPresenter.sync).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          kind: TacticalHighlightKind.Initiative,
          coord: player.position,
        }),
      ]),
    );

    controller.clickHex(player.position);
    expect(feedbackPresenter.sync).toHaveBeenLastCalledWith(
      expect.not.arrayContaining([
        expect.objectContaining({ kind: TacticalHighlightKind.Initiative }),
      ]),
    );

    controller.clearInitiativeQueueHighlight();
    expect(feedbackPresenter.sync).toHaveBeenLastCalledWith(
      expect.not.arrayContaining([
        expect.objectContaining({ kind: TacticalHighlightKind.Initiative }),
      ]),
    );
  });

  it("synchronizes one tactical update only when a click changes board state", () => {
    const player = new Player(
      "player",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
    );
    const session = new GameSession(new GameMap(mapData), [player]);
    const presenter = createTacticalPresentationPresenter();
    const controller = new GameController(session, presenter);

    controller.clickHex({ q: 0, r: 0 });
    expect(presenter.sync).not.toHaveBeenCalled();

    controller.clickHex({ q: 1, r: 0 });
    expect(presenter.sync).toHaveBeenCalledTimes(1);
    expect(presenter.sync).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Move,
        unit: expect.objectContaining({ id: player.id, position: { q: 1, r: 0 } }),
        from: { q: 0, r: 0 },
        steps: [{ q: 1, r: 0 }],
      }),
    ], true);
  });

  it("synchronizes a direct attack with its immutable health snapshot", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const enemy = new Unit("enemy", { q: 1, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(new GameMap(mapData), [mage, enemy]);
    const presenter = createTacticalPresentationPresenter();
    const controller = new GameController(session, presenter);

    controller.clickHex(mage.position);

    expect(controller.clickHex(enemy.position)).toMatchObject({
      type: GameActionType.Attacked,
      attackerId: mage.id,
      targetId: enemy.id,
    });
    expect(presenter.sync).toHaveBeenCalledTimes(1);
    expect(presenter.sync).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Attack,
        attacker: expect.objectContaining({ id: mage.id }),
        target: expect.objectContaining({
          id: enemy.id,
          currentHp: enemy.maxHp - mage.attackPower,
        }),
      }),
    ], true);
  });

  it("blocks input while tactical events remain queued", () => {
    const player = new Player(
      "player",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
    );
    const session = new GameSession(new GameMap(mapData), [player]);
    let isAnimating = false;
    const tacticalPresentationPresenter: TacticalPresentationPresenter = {
      get isAnimating(): boolean {
        return isAnimating;
      },
      sync: vi.fn((events) => {
        isAnimating = events.length > 0;
      }),
    };
    const controller = new GameController(
      session,
      tacticalPresentationPresenter,
    );

    controller.clickHex(player.position);
    expect(controller.clickHex({ q: 1, r: 0 })).toMatchObject({
      type: GameActionType.Moved,
      unitId: player.id,
    });
    expect(tacticalPresentationPresenter.sync).toHaveBeenCalledTimes(1);
    expect(tacticalPresentationPresenter.sync).toHaveBeenLastCalledWith([
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Move,
        unit: expect.objectContaining({ id: player.id }),
        from: { q: 0, r: 0 },
        steps: [{ q: 1, r: 0 }],
      }),
    ], true);
    expect(controller.previewHex({ q: 0, r: 0 })).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.PresentationBusy,
    });
    expect(controller.clickHex({ q: 0, r: 0 })).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.PresentationBusy,
    });
  });

  it("publishes the timeline state after the Mage waits", () => {
    const player = new Player(
      "player",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
    );
    const session = new GameSession(new GameMap(mapData), [player]);
    const presenter = createTacticalPresentationPresenter();
    const timelinePresenter: TimelinePresenter = { sync: vi.fn() };
    const controller = new GameController(
      session,
      presenter,
      undefined,
      timelinePresenter,
    );

    expect(timelinePresenter.sync).toHaveBeenLastCalledWith({
      currentTime: 0,
      readyActorId: player.id,
      readyActorActionPoints: actionPointsPerActivation,
      actionPointsPerActivation,
      readyActorHasWaited: false,
      readyActorRecoveryDelay: baseTimelineRecoveryDelay,
    });
    expect(controller.waitForMage()).toEqual({
      type: GameActionType.Waited,
      unitId: player.id,
    });
    expect(presenter.sync).not.toHaveBeenCalled();
    expect(timelinePresenter.sync).toHaveBeenLastCalledWith({
      currentTime: 0,
      readyActorId: player.id,
      readyActorActionPoints: actionPointsPerActivation,
      actionPointsPerActivation,
      readyActorHasWaited: true,
      readyActorRecoveryDelay: baseTimelineRecoveryDelay,
    });
  });

  it("ends the ready Mage activation without requiring Wait first", () => {
    const player = new Player(
      "player",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
    );
    const session = new GameSession(new GameMap(mapData), [player]);
    const presenter = createTacticalPresentationPresenter();
    const timelinePresenter: TimelinePresenter = { sync: vi.fn() };
    const controller = new GameController(
      session,
      presenter,
      undefined,
      timelinePresenter,
    );

    expect(controller.endMageTurn()).toEqual({
      type: GameActionType.TurnEnded,
      unitId: player.id,
    });
    expect(timelinePresenter.sync).toHaveBeenLastCalledWith({
      currentTime: baseTimelineRecoveryDelay,
      readyActorId: player.id,
      readyActorActionPoints: actionPointsPerActivation,
      actionPointsPerActivation,
      readyActorHasWaited: false,
      readyActorRecoveryDelay: baseTimelineRecoveryDelay,
    });
  });

  it("passes autonomous Move then Attack events to presentation in resolution order", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const enemy = new Unit("enemy", { q: 2, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(new GameMap(pursuitMapData), [mage, enemy]);
    const presenter = createTacticalPresentationPresenter();
    const controller = new GameController(session, presenter);

    controller.waitForMage();

    expect(presenter.sync).toHaveBeenCalledTimes(1);
    expect(presenter.sync).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Move,
        unit: expect.objectContaining({ id: enemy.id, position: { q: 1, r: 0 } }),
        from: { q: 2, r: 0 },
        steps: [{ q: 1, r: 0 }],
      }),
      expect.objectContaining({
        kind: TacticalPresentationEventKind.Attack,
        attacker: expect.objectContaining({ id: enemy.id }),
        target: expect.objectContaining({
          id: mage.id,
          currentHp: mage.maxHp - enemy.attackPower,
        }),
      }),
    ], true);
    expect(mage.currentHp).toBe(mage.maxHp - enemy.attackPower);
  });

  it("requests a fog-safe visibility sync without hidden event data", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle, {
      currentHp: 20,
    });
    const enemy = new Unit("enemy", { q: 1, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(new GameMap(mapData), [mage, enemy]);
    const presenter = createTacticalPresentationPresenter();
    const controller = new GameController(session, presenter);

    controller.waitForMage();

    expect(mage.isAlive).toBe(false);
    expect(presenter.sync).toHaveBeenCalledWith([], true);
  });

  it("presents a servant as a command target without granting direct control", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit("servant", { q: 1, r: 0 }, UnitTexture.PlayerIdle, {
      faction: Faction.Player,
    });
    const session = new GameSession(new GameMap(mapData), [mage, servant]);
    const tacticalPresentationPresenter = createTacticalPresentationPresenter();
    const commandPresenter: ServantCommandPresenter = { sync: vi.fn() };
    const feedbackPresenter: TacticalFeedbackPresenter = { sync: vi.fn() };
    const controller = new GameController(
      session,
      tacticalPresentationPresenter,
      feedbackPresenter,
      undefined,
      commandPresenter,
    );

    controller.clickHex(mage.position);
    expect(controller.clickHex(servant.position)).toEqual({
      type: GameActionType.ServantCommandTargetSelected,
      servantId: servant.id,
    });
    expect(commandPresenter.sync).toHaveBeenLastCalledWith({
      targetServantId: servant.id,
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
    controller.previewHex(servant.position);
    expect(feedbackPresenter.sync).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          kind: TacticalHighlightKind.Command,
          coord: servant.position,
        }),
      ]),
    );

    expect(controller.assignHoldStrategy()).toMatchObject({
      type: GameActionType.StrategyAssigned,
      servantId: servant.id,
    });
    expect(session.timelinePresentation).toMatchObject({
      currentTime: 0,
      readyActorId: mage.id,
      readyActorActionPoints: actionPointsPerActivation
        - TacticalActionPointCost.ServantStrategyCommand,
    });
    expect(tacticalPresentationPresenter.sync).not.toHaveBeenCalled();
    expect(commandPresenter.sync).toHaveBeenLastCalledWith({
      targetServantId: servant.id,
      targetStrategyType: ServantStrategyType.Hold,
      visiblePursuitTargetId: undefined,
      visibleSecureTargetHex: undefined,
      canAssignHold: false,
      canAssignPursue: true,
      canAssignSecure: true,
      canAssignProtect: true,
      canClearStrategy: true,
      targetSelection: undefined,
    });
  });

  it("assigns Protect Mage through the controller and preserves the Mage turn", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit("servant", { q: 1, r: 0 }, UnitTexture.PlayerIdle, {
      faction: Faction.Player,
    });
    const session = new GameSession(new GameMap(mapData), [mage, servant]);
    const commandPresenter: ServantCommandPresenter = { sync: vi.fn() };
    const controller = new GameController(
      session,
      createTacticalPresentationPresenter(),
      undefined,
      undefined,
      commandPresenter,
    );

    controller.clickHex(mage.position);
    controller.clickHex(servant.position);

    expect(controller.assignProtectMageStrategy()).toEqual({
      type: GameActionType.StrategyAssigned,
      servantId: servant.id,
      strategyType: ServantStrategyType.ProtectMage,
    });
    expect(session.timelinePresentation).toMatchObject({
      readyActorId: mage.id,
      readyActorActionPoints: actionPointsPerActivation
        - TacticalActionPointCost.ServantStrategyCommand,
    });
    expect(commandPresenter.sync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetServantId: servant.id,
        canAssignProtect: false,
      }),
    );
  });

  it("guides an explicit Pursue target selection without revealing an unselected target", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit("servant", { q: 1, r: 0 }, UnitTexture.PlayerIdle, {
      faction: Faction.Player,
    });
    const enemy = new Unit("enemy", { q: 2, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
    });
    const session = new GameSession(
      new GameMap(pursuitMapData),
      [mage, servant, enemy],
    );
    const commandPresenter: ServantCommandPresenter = { sync: vi.fn() };
    const feedbackPresenter: TacticalFeedbackPresenter = { sync: vi.fn() };
    const controller = new GameController(
      session,
      createTacticalPresentationPresenter(),
      feedbackPresenter,
      undefined,
      commandPresenter,
    );

    controller.clickHex(mage.position);
    controller.clickHex(servant.position);
    expect(controller.beginPursueDesignatedEnemySelection()).toEqual({
      type: GameActionType.PursuitTargetSelectionStarted,
      servantId: servant.id,
    });
    expect(commandPresenter.sync).toHaveBeenLastCalledWith({
      targetServantId: servant.id,
      targetStrategyType: undefined,
      visiblePursuitTargetId: undefined,
      visibleSecureTargetHex: undefined,
      canAssignHold: false,
      canAssignPursue: false,
      canAssignSecure: false,
      canAssignProtect: false,
      canClearStrategy: true,
      targetSelection: ServantStrategyTargetSelection.PursueEnemy,
    });
    expect(controller.previewHex(enemy.position)).toMatchObject({
      targetId: enemy.id,
    });

    expect(controller.clickHex(enemy.position)).toMatchObject({
      type: GameActionType.StrategyAssigned,
      servantId: servant.id,
      targetId: enemy.id,
    });
    controller.clickHex(servant.position);
    expect(commandPresenter.sync).toHaveBeenLastCalledWith({
      targetServantId: servant.id,
      targetStrategyType: ServantStrategyType.PursueDesignatedEnemy,
      visiblePursuitTargetId: enemy.id,
      visibleSecureTargetHex: undefined,
      canAssignHold: true,
      canAssignPursue: true,
      canAssignSecure: true,
      canAssignProtect: true,
      canClearStrategy: true,
      targetSelection: undefined,
    });
    expect(feedbackPresenter.sync).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          kind: TacticalHighlightKind.Command,
          coord: servant.position,
        }),
        expect.objectContaining({
          kind: TacticalHighlightKind.Command,
          coord: enemy.position,
        }),
      ]),
    );
  });

  it("guides a visible Secure-hex selection and presents its safe marker", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit("servant", { q: 1, r: 0 }, UnitTexture.PlayerIdle, {
      faction: Faction.Player,
    });
    const neutral = new Unit("neutral", { q: 2, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Neutral,
    });
    const session = new GameSession(
      new GameMap(pursuitMapData),
      [mage, servant, neutral],
    );
    const commandPresenter: ServantCommandPresenter = { sync: vi.fn() };
    const feedbackPresenter: TacticalFeedbackPresenter = { sync: vi.fn() };
    const controller = new GameController(
      session,
      createTacticalPresentationPresenter(),
      feedbackPresenter,
      undefined,
      commandPresenter,
    );

    controller.clickHex(mage.position);
    controller.clickHex(servant.position);
    expect(controller.beginSecureDesignatedHexSelection()).toEqual({
      type: GameActionType.SecureTargetSelectionStarted,
      servantId: servant.id,
    });
    expect(commandPresenter.sync).toHaveBeenLastCalledWith({
      targetServantId: servant.id,
      targetStrategyType: undefined,
      visiblePursuitTargetId: undefined,
      visibleSecureTargetHex: undefined,
      canAssignHold: false,
      canAssignPursue: false,
      canAssignSecure: false,
      canAssignProtect: false,
      canClearStrategy: true,
      targetSelection: ServantStrategyTargetSelection.SecureHex,
    });
    expect(controller.previewHex(neutral.position)).toMatchObject({
      targetHex: neutral.position,
    });
    expect(feedbackPresenter.sync).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          kind: TacticalHighlightKind.Command,
          coord: neutral.position,
        }),
      ]),
    );

    expect(controller.clickHex(neutral.position)).toMatchObject({
      type: GameActionType.StrategyAssigned,
      servantId: servant.id,
      strategyType: ServantStrategyType.SecureDesignatedHex,
      targetHex: neutral.position,
    });
    controller.clickHex(servant.position);
    expect(commandPresenter.sync).toHaveBeenLastCalledWith({
      targetServantId: servant.id,
      targetStrategyType: ServantStrategyType.SecureDesignatedHex,
      visiblePursuitTargetId: undefined,
      visibleSecureTargetHex: neutral.position,
      canAssignHold: true,
      canAssignPursue: true,
      canAssignSecure: true,
      canAssignProtect: true,
      canClearStrategy: true,
      targetSelection: undefined,
    });
  });
});

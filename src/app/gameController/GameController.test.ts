import { describe, expect, it, vi } from "vitest";
import {
  GameController,
  type ServantCommandPresenter,
  type TacticalFeedbackPresenter,
  type TimelinePresenter,
  type UnitPresenter,
} from "@/app/gameController/GameController";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { GameActionType, GameSession } from "@/game/gameSession/GameSession";
import {
  TimelineAction,
  timelineActionCosts,
} from "@/game/eventTimeline/EventTimeline";
import { Faction } from "@/game/faction/Faction";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
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

describe("GameController", () => {
  it("updates the unit presenter only when a click results in movement", () => {
    const player = new Player(
      "player",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
    );
    const session = new GameSession(new GameMap(mapData), [player]);
    const presenter: UnitPresenter = { sync: vi.fn() };
    const controller = new GameController(session, presenter);

    controller.clickHex({ q: 0, r: 0 });
    expect(presenter.sync).not.toHaveBeenCalled();

    controller.clickHex({ q: 1, r: 0 });
    expect(presenter.sync).toHaveBeenCalledTimes(1);
    expect(presenter.sync).toHaveBeenCalledWith(player);
  });

  it("publishes the timeline state after the Mage waits", () => {
    const player = new Player(
      "player",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
    );
    const session = new GameSession(new GameMap(mapData), [player]);
    const presenter: UnitPresenter = { sync: vi.fn() };
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
      actionCosts: timelineActionCosts,
    });
    expect(controller.waitForMage()).toEqual({
      type: GameActionType.Waited,
      unitId: player.id,
    });
    expect(timelinePresenter.sync).toHaveBeenLastCalledWith({
      currentTime: timelineActionCosts[TimelineAction.Wait],
      readyActorId: player.id,
      actionCosts: timelineActionCosts,
    });
  });

  it("presents a servant as a command target without granting direct control", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const servant = new Unit("servant", { q: 1, r: 0 }, UnitTexture.PlayerIdle, {
      faction: Faction.Player,
    });
    const session = new GameSession(new GameMap(mapData), [mage, servant]);
    const unitPresenter: UnitPresenter = { sync: vi.fn() };
    const commandPresenter: ServantCommandPresenter = { sync: vi.fn() };
    const feedbackPresenter: TacticalFeedbackPresenter = { sync: vi.fn() };
    const controller = new GameController(
      session,
      unitPresenter,
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
      canAssignHold: true,
      canClearStrategy: false,
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
      currentTime: timelineActionCosts[TimelineAction.Command],
      readyActorId: mage.id,
    });
    expect(commandPresenter.sync).toHaveBeenLastCalledWith({
      targetServantId: undefined,
      targetStrategyType: undefined,
      canAssignHold: false,
      canClearStrategy: false,
    });
  });
});

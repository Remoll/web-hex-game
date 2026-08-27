import { describe, expect, it, vi } from "vitest";
import {
  GameController,
  type TimelinePresenter,
  type UnitPresenter,
} from "@/app/gameController/GameController";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { GameActionType, GameSession } from "@/game/gameSession/GameSession";
import {
  TimelineAction,
  timelineActionCosts,
} from "@/game/eventTimeline/EventTimeline";
import { UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
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
});

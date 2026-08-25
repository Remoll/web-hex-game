import { describe, expect, it, vi } from "vitest";
import { GameController, type UnitPresenter } from "@/app/gameController/GameController";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { GameSession } from "@/game/gameSession/GameSession";
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
    const player = new Player("player", { q: 0, r: 0 });
    const session = new GameSession(new GameMap(mapData), [player]);
    const presenter: UnitPresenter = { sync: vi.fn() };
    const controller = new GameController(session, presenter);

    controller.clickHex({ q: 0, r: 0 });
    expect(presenter.sync).not.toHaveBeenCalled();

    controller.clickHex({ q: 1, r: 0 });
    expect(presenter.sync).toHaveBeenCalledTimes(1);
    expect(presenter.sync).toHaveBeenCalledWith(player);
  });
});

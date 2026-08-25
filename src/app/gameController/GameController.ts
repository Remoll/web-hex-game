import {
  GameSession,
  type GameAction,
} from "@/game/gameSession/GameSession";
import type { Unit } from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";

export interface UnitPresenter {
  sync(unit: Unit): void;
}

/** Connects domain actions to the presentation layer without exposing Three.js to the game. */
export class GameController {
  constructor(
    private readonly session: GameSession,
    private readonly unitPresenter: UnitPresenter,
  ) {}

  clickHex(coord: HexCoord): GameAction {
    const action = this.session.clickHex(coord);

    if (action.type === "moved") {
      const unit = this.session.getUnit(action.unitId);
      if (unit) {
        this.unitPresenter.sync(unit);
      }
    }

    return action;
  }
}

import {
  GameSession,
  type GameAction,
  type GameActionPreview,
} from "@/game/gameSession/GameSession";
import type { Unit } from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";
import type {
  TacticalHighlight,
} from "@/rendering/mapHighlightView/MapHighlightRenderModel";

export interface UnitPresenter {
  sync(unit: Unit): void;
}

export interface TacticalFeedbackPresenter {
  sync(highlights: readonly TacticalHighlight[]): void;
}

const noopFeedbackPresenter: TacticalFeedbackPresenter = {
  sync: () => undefined,
};

/** Connects domain actions to the presentation layer without exposing Three.js to the game. */
export class GameController {
  constructor(
    private readonly session: GameSession,
    private readonly unitPresenter: UnitPresenter,
    private readonly tacticalFeedbackPresenter: TacticalFeedbackPresenter = noopFeedbackPresenter,
  ) {
    this.refreshTacticalFeedback();
  }

  clickHex(coord: HexCoord): GameAction {
    const action = this.session.clickHex(coord);

    if (action.type === "moved") {
      this.syncUnit(action.unitId);
    }

    if (action.type === "attacked") {
      this.syncUnit(action.attackerId);
      this.syncUnit(action.targetId);
    }

    this.refreshTacticalFeedback();

    return action;
  }

  previewHex(coord: HexCoord): GameActionPreview {
    const preview = this.session.previewHex(coord);
    this.refreshTacticalFeedback(preview);
    return preview;
  }

  clearPreview(): void {
    this.refreshTacticalFeedback();
  }

  get hasSelectedUnit(): boolean {
    return this.session.selectedUnitId !== null;
  }

  private syncUnit(unitId: string): void {
    const unit = this.session.getUnit(unitId);
    if (unit) {
      this.unitPresenter.sync(unit);
    }
  }

  private refreshTacticalFeedback(preview?: GameActionPreview): void {
    const highlights: TacticalHighlight[] = [];
    const selectedUnitId = this.session.selectedUnitId;
    const selectedUnit = selectedUnitId
      ? this.session.getUnit(selectedUnitId)
      : undefined;

    if (selectedUnit?.isAlive) {
      highlights.push({ kind: "selected", coord: selectedUnit.position });
      for (const reachableHex of this.session.getReachableHexes()) {
        highlights.push({ kind: "move", coord: reachableHex.coord });
      }
    }

    if (preview?.type === "valid-attack") {
      const target = this.session.getUnit(preview.targetId);
      if (target?.isAlive) {
        highlights.push({ kind: "attack", coord: target.position });
      }
    }

    this.tacticalFeedbackPresenter.sync(highlights);
  }
}

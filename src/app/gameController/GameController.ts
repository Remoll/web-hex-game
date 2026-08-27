import {
  GameSession,
  GameActionPreviewType,
  GameActionType,
  type GameAction,
  type GameActionPreview,
} from "@/game/gameSession/GameSession";
import type { TimelinePresentation } from "@/game/eventTimeline/EventTimeline";
import type { ServantCommandPresentation } from "@/game/gameSession/GameSession";
import type { Unit } from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";
import {
  TacticalHighlightKind,
  type TacticalHighlight,
} from "@/rendering/mapHighlightView/MapHighlightRenderModel";

export interface UnitPresenter {
  sync(unit: Unit): void;
}

export interface TacticalFeedbackPresenter {
  sync(highlights: readonly TacticalHighlight[]): void;
}

export interface TimelinePresenter {
  sync(presentation: TimelinePresentation): void;
}

export interface ServantCommandPresenter {
  sync(presentation: ServantCommandPresentation): void;
}

const noopFeedbackPresenter: TacticalFeedbackPresenter = {
  sync: () => undefined,
};

const noopTimelinePresenter: TimelinePresenter = {
  sync: () => undefined,
};

const noopServantCommandPresenter: ServantCommandPresenter = {
  sync: () => undefined,
};

/** Connects domain actions to the presentation layer without exposing Three.js to the game. */
export class GameController {
  constructor(
    private readonly session: GameSession,
    private readonly unitPresenter: UnitPresenter,
    private readonly tacticalFeedbackPresenter: TacticalFeedbackPresenter = noopFeedbackPresenter,
    private readonly timelinePresenter: TimelinePresenter = noopTimelinePresenter,
    private readonly servantCommandPresenter: ServantCommandPresenter = noopServantCommandPresenter,
  ) {
    this.refreshTacticalFeedback();
    this.syncTimelinePresentation();
    this.syncServantCommandPresentation();
  }

  clickHex(coord: HexCoord): GameAction {
    const action = this.session.clickHex(coord);

    if (action.type === GameActionType.StrategyAssigned
      || action.type === GameActionType.StrategyCleared) {
      this.session.resolveAutonomousActivations();
    }

    if (action.type === GameActionType.Moved) {
      this.syncUnit(action.unitId);
    }

    if (action.type === GameActionType.Attacked) {
      this.syncUnit(action.attackerId);
      this.syncUnit(action.targetId);
    }
    this.syncAutonomousUnitUpdates();

    this.refreshTacticalFeedback();
    this.syncTimelinePresentation();
    this.syncServantCommandPresentation();

    return action;
  }

  waitForMage(): GameAction {
    const action = this.session.waitForMage();
    this.syncAutonomousUnitUpdates();
    this.refreshTacticalFeedback();
    this.syncTimelinePresentation();
    this.syncServantCommandPresentation();
    return action;
  }

  assignHoldStrategy(): GameAction {
    const action = this.session.assignHoldStrategy();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  beginPursueDesignatedEnemySelection(): GameAction {
    const action = this.session.beginPursueDesignatedEnemySelection();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  clearServantStrategy(): GameAction {
    const action = this.session.clearServantStrategy();
    this.resolveAutonomousActivationsAfterCommand(action);
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

  private syncAutonomousUnitUpdates(): void {
    for (const unit of this.session.consumeAutonomousUnitUpdates()) {
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
      highlights.push({
        kind: TacticalHighlightKind.Selected,
        coord: selectedUnit.position,
      });
      for (const reachableHex of this.session.getReachableHexes()) {
        highlights.push({
          kind: TacticalHighlightKind.Move,
          coord: reachableHex.coord,
        });
      }
    }

    const commandTargetId = this.session.servantCommandPresentation.targetServantId;
    const commandTarget = commandTargetId
      ? this.session.getUnit(commandTargetId)
      : undefined;
    if (commandTarget?.isAlive) {
      highlights.push({
        kind: TacticalHighlightKind.Command,
        coord: commandTarget.position,
      });
    }

    const visiblePursuitTargetId = this.session.servantCommandPresentation
      .visiblePursuitTargetId;
    const visiblePursuitTarget = visiblePursuitTargetId
      ? this.session.getUnit(visiblePursuitTargetId)
      : undefined;
    if (visiblePursuitTarget?.isAlive) {
      highlights.push({
        kind: TacticalHighlightKind.Command,
        coord: visiblePursuitTarget.position,
      });
    }

    if (preview?.type === GameActionPreviewType.ValidAttack) {
      const target = this.session.getUnit(preview.targetId);
      if (target?.isAlive) {
        highlights.push({
          kind: TacticalHighlightKind.Attack,
          coord: target.position,
        });
      }
    }

    if (preview?.type === GameActionPreviewType.ServantCommandSelection) {
      const target = this.session.getUnit(preview.servantId);
      if (target?.isAlive) {
        highlights.push({
          kind: TacticalHighlightKind.Command,
          coord: target.position,
        });
      }
    }

    if (preview?.type === GameActionPreviewType.PursuitTargetSelection) {
      const target = this.session.getUnit(preview.targetId);
      if (target?.isAlive) {
        highlights.push({
          kind: TacticalHighlightKind.Command,
          coord: target.position,
        });
      }
    }

    this.tacticalFeedbackPresenter.sync(highlights);
  }

  private syncTimelinePresentation(): void {
    this.timelinePresenter.sync(this.session.timelinePresentation);
  }

  private syncServantCommandPresentation(): void {
    this.servantCommandPresenter.sync(this.session.servantCommandPresentation);
  }

  private resolveAutonomousActivationsAfterCommand(action: GameAction): void {
    if (action.type === GameActionType.StrategyAssigned
      || action.type === GameActionType.StrategyCleared) {
      this.session.resolveAutonomousActivations();
    }

    this.syncAutonomousUnitUpdates();
    this.refreshTacticalFeedback();
    this.syncTimelinePresentation();
    this.syncServantCommandPresentation();
  }
}

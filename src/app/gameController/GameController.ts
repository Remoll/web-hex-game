import {
  GameSession,
  GameActionRejectionReason,
  GameActionPreviewType,
  GameActionType,
  type GameAction,
  type GameActionPreview,
  type InitiativeQueuePresentation,
  type ServantCommandPresentation,
  type UnitMovementEvent,
} from "@/game/gameSession/GameSession";
import type { TimelinePresentation } from "@/game/eventTimeline/EventTimeline";
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

export interface InitiativeQueuePresenter {
  sync(presentation: InitiativeQueuePresentation): void;
}

/** Presentation-only movement playback; it never changes the GameSession. */
export interface UnitMovementPresenter {
  readonly isAnimating: boolean;
  sync(events: readonly UnitMovementEvent[]): void;
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

const noopInitiativeQueuePresenter: InitiativeQueuePresenter = {
  sync: () => undefined,
};

const noopUnitMovementPresenter: UnitMovementPresenter = {
  isAnimating: false,
  sync: () => undefined,
};

/** Connects domain actions to the presentation layer without exposing Three.js to the game. */
export class GameController {
  private initiativeQueueHighlightedUnitId: string | undefined;

  constructor(
    private readonly session: GameSession,
    private readonly unitPresenter: UnitPresenter,
    private readonly tacticalFeedbackPresenter: TacticalFeedbackPresenter = noopFeedbackPresenter,
    private readonly timelinePresenter: TimelinePresenter = noopTimelinePresenter,
    private readonly servantCommandPresenter: ServantCommandPresenter = noopServantCommandPresenter,
    private readonly initiativeQueuePresenter: InitiativeQueuePresenter = noopInitiativeQueuePresenter,
    private readonly unitMovementPresenter: UnitMovementPresenter = noopUnitMovementPresenter,
  ) {
    this.syncTimelinePresentation();
    this.syncServantCommandPresentation();
    this.syncInitiativeQueuePresentation();
    this.refreshTacticalFeedback();
  }

  clickHex(coord: HexCoord): GameAction {
    if (this.unitMovementPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.clickHex(coord);

    if (action.type === GameActionType.StrategyAssigned
      || action.type === GameActionType.StrategyCleared) {
      this.session.resolveAutonomousActivations();
    }

    this.syncMovementPresentation();

    if (action.type === GameActionType.Moved) {
      this.syncUnit(action.unitId);
    }

    if (action.type === GameActionType.Attacked) {
      this.syncUnit(action.attackerId);
      this.syncUnit(action.targetId);
    }
    this.syncAutonomousUnitUpdates();

    this.syncTimelinePresentation();
    this.syncServantCommandPresentation();
    this.syncInitiativeQueuePresentation();
    this.refreshTacticalFeedback();

    return action;
  }

  waitForMage(): GameAction {
    if (this.unitMovementPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.waitForMage();
    this.syncMovementPresentation();
    this.syncAutonomousUnitUpdates();
    this.syncTimelinePresentation();
    this.syncServantCommandPresentation();
    this.syncInitiativeQueuePresentation();
    this.refreshTacticalFeedback();
    return action;
  }

  assignHoldStrategy(): GameAction {
    if (this.unitMovementPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.assignHoldStrategy();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  beginPursueDesignatedEnemySelection(): GameAction {
    if (this.unitMovementPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.beginPursueDesignatedEnemySelection();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  beginSecureDesignatedHexSelection(): GameAction {
    if (this.unitMovementPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.beginSecureDesignatedHexSelection();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  clearServantStrategy(): GameAction {
    if (this.unitMovementPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.clearServantStrategy();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  previewHex(coord: HexCoord): GameActionPreview {
    if (this.unitMovementPresenter.isAnimating) {
      const preview: GameActionPreview = {
        type: GameActionPreviewType.OutOfRange,
        reason: GameActionRejectionReason.PresentationBusy,
      };
      this.refreshTacticalFeedback();
      return preview;
    }

    const preview = this.session.previewHex(coord);
    this.refreshTacticalFeedback(preview);
    return preview;
  }

  clearPreview(): void {
    this.refreshTacticalFeedback();
  }

  /** Applies a temporary queue hover/focus/tap highlight only if still safe. */
  highlightInitiativeQueueUnit(unitId: string): void {
    this.initiativeQueueHighlightedUnitId = this.session
      .getInitiativeQueueHighlightUnitId(unitId);
    this.refreshTacticalFeedback();
  }

  clearInitiativeQueueHighlight(): void {
    this.initiativeQueueHighlightedUnitId = undefined;
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

  private syncMovementPresentation(): void {
    this.unitMovementPresenter.sync(this.session.consumeMovementEvents());
  }

  private presentationBusyAction(): GameAction {
    this.refreshTacticalFeedback();
    return {
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.PresentationBusy,
    };
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

    const initiativeQueueUnit = this.initiativeQueueHighlightedUnitId
      ? this.session.getUnit(this.initiativeQueueHighlightedUnitId)
      : undefined;
    if (initiativeQueueUnit?.isAlive && this.session.isUnitVisible(initiativeQueueUnit)) {
      highlights.push({
        kind: TacticalHighlightKind.Initiative,
        coord: initiativeQueueUnit.position,
      });
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

    const visibleSecureTargetHex = this.session.servantCommandPresentation
      .visibleSecureTargetHex;
    if (visibleSecureTargetHex) {
      highlights.push({
        kind: TacticalHighlightKind.Command,
        coord: visibleSecureTargetHex,
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

    if (preview?.type === GameActionPreviewType.SecureTargetSelection) {
      highlights.push({
        kind: TacticalHighlightKind.Command,
        coord: preview.targetHex,
      });
    }

    this.tacticalFeedbackPresenter.sync(highlights);
  }

  private syncTimelinePresentation(): void {
    this.timelinePresenter.sync(this.session.timelinePresentation);
  }

  private syncServantCommandPresentation(): void {
    this.servantCommandPresenter.sync(this.session.servantCommandPresentation);
  }

  private syncInitiativeQueuePresentation(): void {
    this.initiativeQueueHighlightedUnitId = undefined;
    this.initiativeQueuePresenter.sync(this.session.initiativeQueuePresentation);
  }

  private resolveAutonomousActivationsAfterCommand(action: GameAction): void {
    if (action.type === GameActionType.StrategyAssigned
      || action.type === GameActionType.StrategyCleared) {
      this.session.resolveAutonomousActivations();
    }

    this.syncMovementPresentation();
    this.syncTimelinePresentation();
    this.syncServantCommandPresentation();
    this.syncAutonomousUnitUpdates();
    this.syncInitiativeQueuePresentation();
    this.refreshTacticalFeedback();
  }
}

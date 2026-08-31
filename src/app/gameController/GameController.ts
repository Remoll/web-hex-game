import {
  GameSession,
  GameActionRejectionReason,
  GameActionPreviewType,
  GameActionType,
  DoorBlockInteractionAction,
  type GameAction,
  type GameActionPreview,
  type DoorBlockInteractionPresentation,
  type InitiativeQueuePresentation,
  type ServantCommandPresentation,
  type TacticalPresentationEvent,
} from "@/game/gameSession/GameSession";
import type { TimelinePresentation } from "@/game/eventTimeline/EventTimeline";
import type { HexCoord } from "@/game/types";
import {
  TacticalHighlightKind,
  type TacticalHighlight,
} from "@/rendering/mapHighlightView/MapHighlightRenderModel";

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

export interface DoorInteractionPresenter {
  sync(presentation: DoorBlockInteractionPresentation | undefined): void;
}

/** Synchronizes one resolved state without allowing presentation to change rules. */
export interface TacticalPresentationPresenter {
  readonly isAnimating: boolean;
  sync(
    events: readonly TacticalPresentationEvent[],
    requiresTacticalVisibilitySync: boolean,
  ): void;
}

const noTacticalPresentationEvents = 0;

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

const noopDoorInteractionPresenter: DoorInteractionPresenter = {
  sync: () => undefined,
};

/** Connects domain actions to the presentation layer without exposing Three.js to the game. */
export class GameController {
  private initiativeQueueHighlightedUnitId: string | undefined;
  private activeDoorBlockId: string | undefined;

  constructor(
    private readonly session: GameSession,
    private readonly tacticalPresentationPresenter: TacticalPresentationPresenter,
    private readonly tacticalFeedbackPresenter: TacticalFeedbackPresenter = noopFeedbackPresenter,
    private readonly timelinePresenter: TimelinePresenter = noopTimelinePresenter,
    private readonly servantCommandPresenter: ServantCommandPresenter = noopServantCommandPresenter,
    private readonly initiativeQueuePresenter: InitiativeQueuePresenter = noopInitiativeQueuePresenter,
    private readonly doorInteractionPresenter: DoorInteractionPresenter = noopDoorInteractionPresenter,
  ) {
    this.syncTacticalInterface();
  }

  clickHex(coord: HexCoord): GameAction {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.clickHex(coord);

    if (action.type === GameActionType.DoorInteractionRequested) {
      this.activeDoorBlockId = action.doorBlockId;
      this.syncDoorInteractionPresentation();
    } else {
      this.clearDoorInteractionPresentation();
    }

    if (action.type === GameActionType.StrategyAssigned
      || action.type === GameActionType.StrategyCleared) {
      this.session.resolveAutonomousActivations();
    }

    this.syncResolvedTacticalPresentation();
    this.syncTacticalInterface();

    return action;
  }

  openDoorBlock(): GameAction {
    return this.performDoorBlockInteraction(DoorBlockInteractionAction.Open);
  }

  closeDoorBlock(): GameAction {
    return this.performDoorBlockInteraction(DoorBlockInteractionAction.Close);
  }

  enterDoorBlock(): GameAction {
    return this.performDoorBlockInteraction(DoorBlockInteractionAction.Enter);
  }

  dismissDoorInteraction(): void {
    this.clearDoorInteractionPresentation();
  }

  waitForMage(): GameAction {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.waitForMage();
    this.clearDoorInteractionPresentation();
    this.syncResolvedTacticalPresentation();
    this.syncTacticalInterface();
    return action;
  }

  endMageTurn(): GameAction {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.endMageTurn();
    this.clearDoorInteractionPresentation();
    this.syncResolvedTacticalPresentation();
    this.syncTacticalInterface();
    return action;
  }

  assignHoldStrategy(): GameAction {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.assignHoldStrategy();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  assignProtectMageStrategy(): GameAction {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.assignProtectMageStrategy();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  beginPursueDesignatedEnemySelection(): GameAction {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.beginPursueDesignatedEnemySelection();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  beginSecureDesignatedHexSelection(): GameAction {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.beginSecureDesignatedHexSelection();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  clearServantStrategy(): GameAction {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const action = this.session.clearServantStrategy();
    this.resolveAutonomousActivationsAfterCommand(action);
    return action;
  }

  previewHex(coord: HexCoord): GameActionPreview {
    if (this.tacticalPresentationPresenter.isAnimating) {
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
    if (this.tacticalPresentationPresenter.isAnimating) {
      return;
    }

    this.initiativeQueueHighlightedUnitId = this.session
      .getInitiativeQueueHighlightUnitId(unitId);
    this.refreshTacticalFeedback();
  }

  clearInitiativeQueueHighlight(): void {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return;
    }

    this.initiativeQueueHighlightedUnitId = undefined;
    this.refreshTacticalFeedback();
  }

  get hasSelectedUnit(): boolean {
    return this.session.selectedUnitId !== null;
  }

  /** Publishes one resolved action's safe visual events without reordering them. */
  private syncResolvedTacticalPresentation(): void {
    const events = this.session.consumeTacticalPresentationEvents();
    const requiresTacticalVisibilitySync = this.session
      .consumeTacticalVisibilitySyncSignal();
    if (events.length === noTacticalPresentationEvents
      && !requiresTacticalVisibilitySync) {
      return;
    }

    this.tacticalPresentationPresenter.sync(events, requiresTacticalVisibilitySync);
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

  /** Refreshes independent UI projections after every completed interaction. */
  private syncTacticalInterface(): void {
    this.syncTimelinePresentation();
    this.syncServantCommandPresentation();
    this.syncInitiativeQueuePresentation();
    this.refreshTacticalFeedback();
  }

  private resolveAutonomousActivationsAfterCommand(action: GameAction): void {
    if (action.type === GameActionType.StrategyAssigned
      || action.type === GameActionType.StrategyCleared) {
      this.session.resolveAutonomousActivations();
    }

    this.syncResolvedTacticalPresentation();
    this.syncTacticalInterface();
  }

  private performDoorBlockInteraction(
    action: DoorBlockInteractionAction,
  ): GameAction {
    if (this.tacticalPresentationPresenter.isAnimating) {
      return this.presentationBusyAction();
    }

    const doorBlockId = this.activeDoorBlockId;
    if (!doorBlockId) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.OutOfRange,
      };
    }

    const resolvedAction = this.session.performDoorBlockInteraction(
      doorBlockId,
      action,
    );
    this.syncResolvedTacticalPresentation();
    this.syncTacticalInterface();
    this.clearDoorInteractionPresentation();
    return resolvedAction;
  }

  private syncDoorInteractionPresentation(): void {
    const doorBlockId = this.activeDoorBlockId;
    const presentation = doorBlockId
      ? this.session.getDoorBlockInteractionPresentation(doorBlockId)
      : undefined;
    if (!presentation) {
      this.activeDoorBlockId = undefined;
    }
    this.doorInteractionPresenter.sync(presentation);
  }

  private clearDoorInteractionPresentation(): void {
    this.activeDoorBlockId = undefined;
    this.doorInteractionPresenter.sync(undefined);
  }
}

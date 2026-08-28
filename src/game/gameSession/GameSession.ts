import { GameMap, type MovementPath } from "@/game/board/gameMap/GameMap";
import {
  Faction,
  FactionDisposition,
  getFactionDisposition,
} from "@/game/faction/Faction";
import {
  EventTimeline,
  TacticalActionPointCost,
  TimelineAction,
  type EventTimelineReader,
  type TimelinePresentation,
} from "@/game/eventTimeline/EventTimeline";
import { EnemyTacticalMemory } from "@/game/enemyAi/EnemyTacticalMemory";
import { ServantTacticalMemory } from "@/game/servantAi/ServantTacticalMemory";
import { Unit, UnitTacticalRole } from "@/game/unit/Unit";
import {
  holdServantStrategy,
  pursueDesignatedEnemyStrategy,
  secureDesignatedHexStrategy,
  ServantStrategyType,
  type ServantStrategy,
} from "@/game/unit/servantStrategy/ServantStrategy";
import type { HexCoord } from "@/game/types";
import {
  FieldVisibility,
  MageVisibility,
  type FieldVisibilityReader,
} from "@/game/visibility/MageVisibility";

export enum GameActionType {
  Selected = "selected",
  Deselected = "deselected",
  ServantCommandTargetSelected = "servant-command-target-selected",
  PursuitTargetSelectionStarted = "pursuit-target-selection-started",
  PursuitTargetSelectionCancelled = "pursuit-target-selection-cancelled",
  SecureTargetSelectionStarted = "secure-target-selection-started",
  SecureTargetSelectionCancelled = "secure-target-selection-cancelled",
  Moved = "moved",
  Attacked = "attacked",
  StrategyAssigned = "strategy-assigned",
  StrategyCleared = "strategy-cleared",
  Waited = "waited",
  TurnEnded = "turn-ended",
  Ignored = "ignored",
}

export enum GameActionPreviewType {
  Selection = "selection",
  ServantCommandSelection = "servant-command-selection",
  PursuitTargetSelection = "pursuit-target-selection",
  SecureTargetSelection = "secure-target-selection",
  ValidMove = "valid-move",
  ValidAttack = "valid-attack",
  OutOfRange = "out-of-range",
}

/** Identifies the target kind currently being chosen for a servant strategy. */
export enum ServantStrategyTargetSelection {
  PursueEnemy = "pursue-enemy",
  SecureHex = "secure-hex",
}

export enum GameActionRejectionReason {
  MissingField = "missing-field",
  NoSelectedUnit = "no-selected-unit",
  NotPlayerControlled = "not-player-controlled",
  NotHostile = "not-hostile",
  NotVisible = "not-visible",
  NotReady = "not-ready",
  InsufficientActionPoints = "insufficient-action-points",
  NoCommandTarget = "no-command-target",
  NoActiveStrategy = "no-active-strategy",
  InvalidEnemyTarget = "invalid-enemy-target",
  StrategyUnchanged = "strategy-unchanged",
  OutOfRange = "out-of-range",
  PresentationBusy = "presentation-busy",
}

export type GameAction =
  | { type: GameActionType.Selected; unitId: string }
  | { type: GameActionType.Deselected; unitId: string }
  | { type: GameActionType.ServantCommandTargetSelected; servantId: string }
  | { type: GameActionType.PursuitTargetSelectionStarted; servantId: string }
  | { type: GameActionType.PursuitTargetSelectionCancelled; servantId: string }
  | { type: GameActionType.SecureTargetSelectionStarted; servantId: string }
  | { type: GameActionType.SecureTargetSelectionCancelled; servantId: string }
  | { type: GameActionType.Moved; unitId: string; from: HexCoord; to: HexCoord }
  | {
    type: GameActionType.Attacked;
    attackerId: string;
    targetId: string;
    damage: number;
    targetCurrentHp: number;
    targetDefeated: boolean;
  }
  | {
    type: GameActionType.StrategyAssigned;
    servantId: string;
    strategyType: ServantStrategyType.Hold;
  }
  | {
    type: GameActionType.StrategyAssigned;
    servantId: string;
    strategyType: ServantStrategyType.PursueDesignatedEnemy;
    targetId: string;
  }
  | {
    type: GameActionType.StrategyAssigned;
    servantId: string;
    strategyType: ServantStrategyType.SecureDesignatedHex;
    targetHex: HexCoord;
  }
  | { type: GameActionType.StrategyCleared; servantId: string }
  | { type: GameActionType.Waited; unitId: string }
  | { type: GameActionType.TurnEnded; unitId: string }
  | {
    type: GameActionType.Ignored;
    reason: GameActionRejectionReason;
  };

export type GameActionPreview =
  | { type: GameActionPreviewType.Selection; unitId: string }
  | { type: GameActionPreviewType.ServantCommandSelection; servantId: string }
  | {
    type: GameActionPreviewType.PursuitTargetSelection;
    servantId: string;
    targetId: string;
  }
  | {
    type: GameActionPreviewType.SecureTargetSelection;
    servantId: string;
    targetHex: HexCoord;
  }
  | {
    type: GameActionPreviewType.ValidMove;
    unitId: string;
    destination: HexCoord;
    path: MovementPath;
  }
  | {
    type: GameActionPreviewType.ValidAttack;
    attackerId: string;
    targetId: string;
  }
  | {
    type: GameActionPreviewType.OutOfRange;
    reason: Exclude<GameActionRejectionReason, GameActionRejectionReason.NoSelectedUnit>;
  };

export interface ReachableHex {
  readonly coord: HexCoord;
  readonly cost: number;
}

/**
 * An immutable presentation event emitted after a legal domain movement.
 * `steps` excludes `from` and preserves the legal path's original order.
 */
export interface UnitMovementEvent {
  readonly unitId: string;
  readonly from: Readonly<HexCoord>;
  readonly steps: readonly Readonly<HexCoord>[];
}

/** Information-safe visual states for initiative cards. */
export enum InitiativeQueueCardState {
  Unknown = "unknown",
  Identified = "identified",
}

/** Display identity intentionally limited to tactical role or faction. */
export enum InitiativeQueueActorLabel {
  Mage = "Mage",
  Servant = "Servant",
  Enemy = "Enemy",
  Neutral = "Neutral",
}

/**
 * Renderer-neutral queue card data. No card contains a coordinate, and an
 * undiscovered Enemy contains neither its identity nor an interaction target.
 */
export interface InitiativeQueueEntry {
  readonly cardId: string;
  readonly state: InitiativeQueueCardState;
  readonly label: InitiativeQueueActorLabel | undefined;
  readonly unitId: string | undefined;
  readonly isCurrent: boolean;
  readonly canHighlight: boolean;
}

export interface InitiativeQueuePresentation {
  readonly entries: readonly InitiativeQueueEntry[];
}

/** Safe UI state: it exposes only the currently visible command target. */
export interface ServantCommandPresentation {
  readonly targetServantId: string | undefined;
  readonly targetStrategyType: ServantStrategyType | undefined;
  /** Exposed only while the designated Enemy remains currently visible. */
  readonly visiblePursuitTargetId: string | undefined;
  /** Exposed only while the designated tactical hex remains currently visible. */
  readonly visibleSecureTargetHex: HexCoord | undefined;
  readonly canAssignHold: boolean;
  readonly canAssignPursue: boolean;
  readonly canAssignSecure: boolean;
  readonly canClearStrategy: boolean;
  readonly targetSelection: ServantStrategyTargetSelection | undefined;
}

/** Owns mutable game state without depending on rendering or browser APIs. */
export class GameSession {
  private readonly unitsById = new Map<string, Unit>();
  private readonly livingUnitIdsByHex = new Map<string, string>();
  private readonly mageId: string;
  private readonly mageVisibility: MageVisibility;
  private readonly timeline: EventTimeline;
  private readonly enemyTacticalMemory = new EnemyTacticalMemory();
  private readonly servantTacticalMemory = new ServantTacticalMemory();
  private readonly servantStrategiesByUnitId = new Map<string, ServantStrategy>();
  private readonly autonomousUnitUpdates = new Set<string>();
  private readonly movementEvents: UnitMovementEvent[] = [];
  private _selectedUnitId: string | null = null;
  private _selectedServantCommandId: string | null = null;
  private _targetSelection: ServantStrategyTargetSelection | undefined;

  constructor(
    public readonly gameMap: GameMap,
    units: Iterable<Unit>,
  ) {
    for (const unit of units) {
      if (this.unitsById.has(unit.id)) {
        throw new Error(`A unit with id ${unit.id} already exists`);
      }
      if (!this.gameMap.getField(unit.position.q, unit.position.r)) {
        throw new Error(`Unit ${unit.id} starts outside the game map`);
      }

      this.unitsById.set(unit.id, unit);
      if (unit.isAlive) {
        this.registerLivingUnit(unit);
      }
    }

    const mages = [...this.unitsById.values()].filter(
      (unit) => unit.isAlive && unit.tacticalRole === UnitTacticalRole.Mage,
    );
    if (mages.length !== 1) {
      throw new Error("A game session requires exactly one living Mage");
    }

    this.mageId = mages[0].id;
    this.mageVisibility = new MageVisibility(this.gameMap);
    this.timeline = new EventTimeline(this.unitsById.values());
    this.resolveAutonomousActivations();
    this.recalculateMageVisibility();
  }

  get selectedUnitId(): string | null {
    return this._selectedUnitId;
  }

  get servantCommandPresentation(): ServantCommandPresentation {
    const target = this.getSelectedCommandServant();
    const strategy = target
      ? this.servantStrategiesByUnitId.get(target.id)
      : undefined;
    const pursuitTarget = strategy?.type === ServantStrategyType.PursueDesignatedEnemy
      ? this.unitsById.get(strategy.targetEnemyId)
      : undefined;
    const targetSelection = target ? this._targetSelection : undefined;
    const secureTargetHex = strategy?.type === ServantStrategyType.SecureDesignatedHex
      ? strategy.targetHex
      : undefined;
    const isSelectingStrategyTarget = targetSelection !== undefined;

    return {
      targetServantId: target?.id,
      targetStrategyType: strategy?.type,
      visiblePursuitTargetId: pursuitTarget?.isAlive
        && this.isUnitVisible(pursuitTarget)
        ? pursuitTarget.id
        : undefined,
      visibleSecureTargetHex: secureTargetHex
        && this.getFieldVisibility(secureTargetHex) === FieldVisibility.Visible
        ? { ...secureTargetHex }
        : undefined,
      canAssignHold: target !== undefined && !isSelectingStrategyTarget,
      canAssignPursue: target !== undefined && !isSelectingStrategyTarget,
      canAssignSecure: target !== undefined && !isSelectingStrategyTarget,
      canClearStrategy: strategy !== undefined || isSelectingStrategyTarget,
      targetSelection,
    };
  }

  /** Includes defeated units so presentation can render their visual remains. */
  get units(): readonly Unit[] {
    return [...this.unitsById.values()];
  }

  getUnit(id: string): Unit | undefined {
    return this.unitsById.get(id);
  }

  /**
   * Simulation state for tests and future AI orchestration. Player-facing
   * presentation must not render this private Enemy memory outside Mage sight.
   */
  getEnemyLastKnownHostilePosition(enemyId: string): HexCoord | undefined {
    return this.enemyTacticalMemory.getLastKnownHostilePosition(enemyId);
  }

  /**
   * Returns the units changed by autonomous resolution since the last call.
   * The application layer uses this to synchronize existing presentation only.
   */
  consumeAutonomousUnitUpdates(): readonly Unit[] {
    const updatedUnits: Unit[] = [];
    for (const unitId of this.autonomousUnitUpdates) {
      const unit = this.unitsById.get(unitId);
      if (unit) {
        updatedUnits.push(unit);
      }
    }
    this.autonomousUnitUpdates.clear();
    return updatedUnits;
  }

  /**
   * Returns each ordered movement exactly once for renderer-only playback.
   * The simulation has already reached its final authoritative state.
   */
  consumeMovementEvents(): readonly UnitMovementEvent[] {
    return this.movementEvents.splice(0);
  }

  /** Stable read-only visibility API for app and rendering adapters. */
  get visibility(): FieldVisibilityReader {
    return this.mageVisibility;
  }

  /** Read-only timeline state for HUDs and future turn orchestration. */
  get eventTimeline(): EventTimelineReader {
    return this.timeline;
  }

  get timelinePresentation(): TimelinePresentation {
    return this.timeline.presentation;
  }

  /**
   * Projects EventTimeline order into cards that are safe under Mage fog.
   * Callers receive no live coordinates and must use canHighlight before
   * requesting a temporary map highlight.
   */
  get initiativeQueuePresentation(): InitiativeQueuePresentation {
    const entries: InitiativeQueueEntry[] = [];
    const scheduledActors = this.timeline.getScheduledActors();
    const currentActorId = this.timeline.readyActor?.unitId;

    for (const [index, actor] of scheduledActors.entries()) {
      const unit = this.unitsById.get(actor.unitId);
      if (!unit) {
        continue;
      }

      const visibility = this.getFieldVisibility(unit.position);
      const isUndiscoveredEnemy = unit.faction === Faction.Enemy
        && visibility === FieldVisibility.Undiscovered;
      if (isUndiscoveredEnemy) {
        entries.push({
          cardId: `${InitiativeQueueCardState.Unknown}-${index}`,
          state: InitiativeQueueCardState.Unknown,
          label: undefined,
          unitId: undefined,
          isCurrent: actor.unitId === currentActorId,
          canHighlight: false,
        });
        continue;
      }

      entries.push({
        cardId: `unit-${unit.id}`,
        state: InitiativeQueueCardState.Identified,
        label: getInitiativeQueueActorLabel(unit),
        unitId: unit.id,
        isCurrent: actor.unitId === currentActorId,
        canHighlight: visibility === FieldVisibility.Visible,
      });
    }

    return { entries };
  }

  /** Revalidates a queue interaction against current visibility and schedule. */
  getInitiativeQueueHighlightUnitId(unitId: string): string | undefined {
    const unit = this.unitsById.get(unitId);
    if (!unit || !unit.isAlive || !this.isUnitVisible(unit)) {
      return undefined;
    }

    return this.timeline.getScheduledActors().some(
      (actor) => actor.unitId === unitId,
    )
      ? unit.id
      : undefined;
  }

  getFieldVisibility(coord: HexCoord): FieldVisibility | undefined {
    return this.mageVisibility.getFieldVisibility(coord);
  }

  /** Visibility remains meaningful for dead units so remains can be hidden safely. */
  isUnitVisible(unit: Unit): boolean {
    return this.getFieldVisibility(unit.position) === FieldVisibility.Visible;
  }

  /** Returns only a living occupant; corpses never block or receive input. */
  getUnitAt(coord: HexCoord): Unit | undefined {
    const unitId = this.livingUnitIdsByHex.get(getCoordKey(coord));
    return unitId ? this.unitsById.get(unitId) : undefined;
  }

  /** Provides movement data for future highlighting without leaking map internals. */
  getReachableHexes(): readonly ReachableHex[] {
    const selectedUnit = this.getSelectedControllableUnit();
    if (!selectedUnit || !this.hasMovementAvailability(selectedUnit)) {
      return [];
    }

    return [...this.getReachablePaths(selectedUnit).values()].map((path) => ({
      coord: { ...path.steps[path.steps.length - 1] },
      cost: path.cost,
    }));
  }

  /** A non-mutating semantic result used by future hover, cursor, and highlight views. */
  previewHex(coord: HexCoord): GameActionPreview {
    if (!this.gameMap.getField(coord.q, coord.r)) {
      return {
        type: GameActionPreviewType.OutOfRange,
        reason: GameActionRejectionReason.MissingField,
      };
    }

    const selectedUnit = this.getSelectedControllableUnit();
    const clickedUnit = this.getUnitAt(coord);

    if (clickedUnit && !this.isUnitVisible(clickedUnit)) {
      return {
        type: GameActionPreviewType.OutOfRange,
        reason: GameActionRejectionReason.NotVisible,
      };
    }

    if (this._targetSelection === ServantStrategyTargetSelection.PursueEnemy) {
      const servant = this.getSelectedCommandServant();
      if (!servant) {
        return {
          type: GameActionPreviewType.OutOfRange,
          reason: GameActionRejectionReason.NoCommandTarget,
        };
      }

      const targetRejection = clickedUnit
        ? this.getPursueTargetRejection(servant, clickedUnit)
        : GameActionRejectionReason.InvalidEnemyTarget;
      return targetRejection
        ? {
          type: GameActionPreviewType.OutOfRange,
          reason: targetRejection,
        }
        : {
          type: GameActionPreviewType.PursuitTargetSelection,
          servantId: servant.id,
          targetId: clickedUnit!.id,
        };
    }

    if (this._targetSelection === ServantStrategyTargetSelection.SecureHex) {
      const servant = this.getSelectedCommandServant();
      if (!servant) {
        return {
          type: GameActionPreviewType.OutOfRange,
          reason: GameActionRejectionReason.NoCommandTarget,
        };
      }

      const targetRejection = this.getSecureTargetRejection(coord);
      return targetRejection
        ? {
          type: GameActionPreviewType.OutOfRange,
          reason: targetRejection,
        }
        : {
          type: GameActionPreviewType.SecureTargetSelection,
          servantId: servant.id,
          targetHex: { ...coord },
        };
    }

    if (!selectedUnit) {
      return clickedUnit && this.isMage(clickedUnit) && this.isMageReady()
        ? { type: GameActionPreviewType.Selection, unitId: clickedUnit.id }
        : {
          type: GameActionPreviewType.OutOfRange,
          reason: clickedUnit
            ? this.isMage(clickedUnit)
              ? GameActionRejectionReason.NotReady
              : GameActionRejectionReason.NotPlayerControlled
            : GameActionRejectionReason.OutOfRange,
        };
    }

    if (isSameHex(selectedUnit.position, coord)) {
      return {
        type: GameActionPreviewType.Selection,
        unitId: selectedUnit.id,
      };
    }

    if (clickedUnit && this.isMage(clickedUnit)) {
      return {
        type: GameActionPreviewType.Selection,
        unitId: clickedUnit.id,
      };
    }

    if (clickedUnit && this.isPlayerFactionServant(clickedUnit)) {
      const rejection = this.getServantCommandRejectionReason(clickedUnit);
      return rejection
        ? {
          type: GameActionPreviewType.OutOfRange,
          reason: rejection,
        }
        : {
          type: GameActionPreviewType.ServantCommandSelection,
          servantId: clickedUnit.id,
        };
    }

    if (clickedUnit) {
      if (!this.hasActionAvailability(selectedUnit)) {
        return {
          type: GameActionPreviewType.OutOfRange,
          reason: this.getAvailabilityRejectionReason(
            selectedUnit,
            TacticalActionPointCost.Attack,
          ),
        };
      }

      if (getFactionDisposition(selectedUnit.faction, clickedUnit.faction)
        !== FactionDisposition.Enemy) {
        return {
          type: GameActionPreviewType.OutOfRange,
          reason: GameActionRejectionReason.NotHostile,
        };
      }

      return this.gameMap.getHexDistance(selectedUnit.position, coord) === 1
        ? {
          type: GameActionPreviewType.ValidAttack,
          attackerId: selectedUnit.id,
          targetId: clickedUnit.id,
        }
        : {
          type: GameActionPreviewType.OutOfRange,
          reason: GameActionRejectionReason.OutOfRange,
        };
    }

    if (!this.hasMovementAvailability(selectedUnit)) {
      return {
        type: GameActionPreviewType.OutOfRange,
        reason: this.getAvailabilityRejectionReason(
          selectedUnit,
          TacticalActionPointCost.Move,
        ),
      };
    }

    const path = this.getReachablePaths(selectedUnit).get(getCoordKey(coord));
    return path
      ? {
        type: GameActionPreviewType.ValidMove,
        unitId: selectedUnit.id,
        destination: { ...coord },
        path,
      }
      : {
        type: GameActionPreviewType.OutOfRange,
        reason: GameActionRejectionReason.OutOfRange,
      };
  }

  clickHex(coord: HexCoord): GameAction {
    if (!this.gameMap.getField(coord.q, coord.r)) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.MissingField,
      };
    }

    const selectedUnit = this.getSelectedControllableUnit();
    if (selectedUnit
      && this._targetSelection === undefined
      && isSameHex(selectedUnit.position, coord)) {
      this._selectedUnitId = null;
      this.clearServantCommandTarget();
      return { type: GameActionType.Deselected, unitId: selectedUnit.id };
    }

    const preview = this.previewHex(coord);
    switch (preview.type) {
      case GameActionPreviewType.Selection:
        this._selectedUnitId = preview.unitId;
        this.clearServantCommandTarget();
        return { type: GameActionType.Selected, unitId: preview.unitId };
      case GameActionPreviewType.ServantCommandSelection:
        this._selectedServantCommandId = preview.servantId;
        this._targetSelection = undefined;
        return {
          type: GameActionType.ServantCommandTargetSelected,
          servantId: preview.servantId,
        };
      case GameActionPreviewType.PursuitTargetSelection:
        return this.assignPursueDesignatedEnemyStrategyToServant(
          preview.servantId,
          preview.targetId,
        );
      case GameActionPreviewType.SecureTargetSelection:
        return this.assignSecureDesignatedHexStrategyToServant(
          preview.servantId,
          preview.targetHex,
        );
      case GameActionPreviewType.ValidMove:
        return this.moveSelectedUnit(preview);
      case GameActionPreviewType.ValidAttack:
        return this.attack(preview);
      case GameActionPreviewType.OutOfRange:
        if (!selectedUnit && !this.getUnitAt(coord)) {
          return {
            type: GameActionType.Ignored,
            reason: GameActionRejectionReason.NoSelectedUnit,
          };
        }

        return { type: GameActionType.Ignored, reason: preview.reason };
    }
  }

  /** Assigns the currently selected visible servant the safe default strategy. */
  assignHoldStrategy(): GameAction {
    const servant = this.getSelectedCommandServant();
    return servant
      ? this.assignHoldStrategyToServant(servant.id)
      : {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
  }

  /** Starts an explicit board-target selection without spending Mage Tempo. */
  beginPursueDesignatedEnemySelection(): GameAction {
    const servant = this.getSelectedCommandServant();
    if (!servant) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
    }

    this._targetSelection = ServantStrategyTargetSelection.PursueEnemy;
    return {
      type: GameActionType.PursuitTargetSelectionStarted,
      servantId: servant.id,
    };
  }

  /** Starts an explicit visible-hex selection without spending Mage Tempo. */
  beginSecureDesignatedHexSelection(): GameAction {
    const servant = this.getSelectedCommandServant();
    if (!servant) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
    }

    this._targetSelection = ServantStrategyTargetSelection.SecureHex;
    return {
      type: GameActionType.SecureTargetSelectionStarted,
      servantId: servant.id,
    };
  }

  /** Clears the current strategy from the selected visible servant. */
  clearServantStrategy(): GameAction {
    const servant = this.getSelectedCommandServant();
    if (!servant) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
    }

    switch (this._targetSelection) {
      case ServantStrategyTargetSelection.PursueEnemy:
        this._targetSelection = undefined;
        return {
          type: GameActionType.PursuitTargetSelectionCancelled,
          servantId: servant.id,
        };
      case ServantStrategyTargetSelection.SecureHex:
        this._targetSelection = undefined;
        return {
          type: GameActionType.SecureTargetSelectionCancelled,
          servantId: servant.id,
        };
      case undefined:
        break;
    }

    return this.clearServantStrategyFromServant(servant.id);
  }

  /** Domain command entry point used by UI adapters after their target selection. */
  assignHoldStrategyToServant(servantId: string): GameAction {
    const servant = this.unitsById.get(servantId);
    if (!servant) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
    }

    const rejection = this.getServantCommandRejectionReason(servant);
    if (rejection) {
      return {
        type: GameActionType.Ignored,
        reason: rejection,
      };
    }

    this.servantStrategiesByUnitId.set(servant.id, holdServantStrategy);
    return this.completeServantStrategyCommand(servant.id, holdServantStrategy);
  }

  /** Assigns one visible Enemy identity to a visible servant for later action. */
  assignPursueDesignatedEnemyStrategyToServant(
    servantId: string,
    targetEnemyId: string,
  ): GameAction {
    const servant = this.unitsById.get(servantId);
    if (!servant) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
    }

    const servantRejection = this.getServantCommandRejectionReason(servant);
    if (servantRejection) {
      return {
        type: GameActionType.Ignored,
        reason: servantRejection,
      };
    }

    const target = this.unitsById.get(targetEnemyId);
    if (!target) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.InvalidEnemyTarget,
      };
    }

    const targetRejection = this.getPursueTargetRejection(servant, target);
    if (targetRejection) {
      return {
        type: GameActionType.Ignored,
        reason: targetRejection,
      };
    }

    const existingStrategy = this.servantStrategiesByUnitId.get(servant.id);
    if (existingStrategy?.type === ServantStrategyType.PursueDesignatedEnemy
      && existingStrategy.targetEnemyId === target.id) {
      this._targetSelection = undefined;
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.StrategyUnchanged,
      };
    }

    const strategy = pursueDesignatedEnemyStrategy(target.id);
    this.servantStrategiesByUnitId.set(servant.id, strategy);
    return this.completeServantStrategyCommand(servant.id, strategy);
  }

  /** Assigns one currently visible tactical hex for the servant to secure. */
  assignSecureDesignatedHexStrategyToServant(
    servantId: string,
    targetHex: HexCoord,
  ): GameAction {
    const servant = this.unitsById.get(servantId);
    if (!servant) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
    }

    const servantRejection = this.getServantCommandRejectionReason(servant);
    if (servantRejection) {
      return {
        type: GameActionType.Ignored,
        reason: servantRejection,
      };
    }

    const targetRejection = this.getSecureTargetRejection(targetHex);
    if (targetRejection) {
      return {
        type: GameActionType.Ignored,
        reason: targetRejection,
      };
    }

    const existingStrategy = this.servantStrategiesByUnitId.get(servant.id);
    if (existingStrategy?.type === ServantStrategyType.SecureDesignatedHex
      && isSameHex(existingStrategy.targetHex, targetHex)) {
      this._targetSelection = undefined;
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.StrategyUnchanged,
      };
    }

    const strategy = secureDesignatedHexStrategy(targetHex);
    this.servantStrategiesByUnitId.set(servant.id, strategy);
    return this.completeServantStrategyCommand(servant.id, strategy);
  }

  /** Domain command entry point used by UI adapters after their target selection. */
  clearServantStrategyFromServant(servantId: string): GameAction {
    const servant = this.unitsById.get(servantId);
    if (!servant) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
    }

    const rejection = this.getServantCommandRejectionReason(servant);
    if (rejection) {
      return {
        type: GameActionType.Ignored,
        reason: rejection,
      };
    }

    if (!this.servantStrategiesByUnitId.has(servant.id)) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoActiveStrategy,
      };
    }

    this.servantStrategiesByUnitId.delete(servant.id);
    this.endMageActivationAfterCommand();
    this.clearServantCommandTarget();
    return { type: GameActionType.StrategyCleared, servantId: servant.id };
  }

  /**
   * Resolves all non-Mage activations up to the next Mage decision. Calling it
   * repeatedly at a Mage decision is a no-op, preventing duplicate dispatch.
   */
  resolveAutonomousActivations(): void {
    if (this.isMageReady()) {
      return;
    }

    this.timeline.advanceAutonomousUnitsToMageDecision(
      this.mageId,
      (participant, remainingActionPoints) => this.resolveAutonomousAction(
        participant.id,
        remainingActionPoints,
      ),
    );
    this.clearStaleCommandTarget();
  }

  /** Defers once, then ends the deferred Mage activation on the next request. */
  waitForMage(): GameAction {
    const mage = this.unitsById.get(this.mageId);
    if (!mage || !mage.isAlive || !this.timeline.isReady(mage.id)) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NotReady,
      };
    }

    if (this.timeline.hasWaitedDuringReadyActivation(mage.id)) {
      this.timeline.endReadyActivation(mage.id);
      this.clearServantCommandTarget();
      this.resolveAutonomousActivations();
      return { type: GameActionType.TurnEnded, unitId: mage.id };
    }

    this.timeline.deferReadyActivation(mage.id);
    this.clearServantCommandTarget();
    this.resolveAutonomousActivations();
    return { type: GameActionType.Waited, unitId: mage.id };
  }

  private moveSelectedUnit(
    preview: Extract<GameActionPreview, { type: GameActionPreviewType.ValidMove }>,
  ): GameAction {
    const unit = this.unitsById.get(preview.unitId);
    if (!unit || !unit.isAlive) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoSelectedUnit,
      };
    }

    if (!this.isMageReady()) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NotReady,
      };
    }
    const remainingActionPoints = this.timeline.spendReadyActionPoints(
      unit.id,
      preview.path.cost,
    );

    const from = unit.position;
    this.moveLivingUnit(unit, preview.destination);
    this.publishMovementEvent(unit.id, from, preview.path.steps);
    if (unit.id === this.mageId) {
      this.recalculateMageVisibility();
      this.clearServantCommandTarget();
      this.resolveAutonomousActivationsIfActivationEnded(unit.id, remainingActionPoints);
    }

    return {
      type: GameActionType.Moved,
      unitId: unit.id,
      from,
      to: unit.position,
    };
  }

  private attack(
    preview: Extract<GameActionPreview, { type: GameActionPreviewType.ValidAttack }>,
  ): GameAction {
    const attacker = this.unitsById.get(preview.attackerId);
    const target = this.unitsById.get(preview.targetId);
    if (!attacker || !target || !attacker.isAlive || !target.isAlive) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.OutOfRange,
      };
    }

    if (!this.isMageReady()) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NotReady,
      };
    }
    const remainingActionPoints = this.timeline.spendReadyActionPoints(
      attacker.id,
      TacticalActionPointCost.Attack,
    );
    this.clearServantCommandTarget();

    this.applyMeleeDamage(attacker, target, false);
    this.resolveAutonomousActivationsIfActivationEnded(
      attacker.id,
      remainingActionPoints,
    );

    return {
      type: GameActionType.Attacked,
      attackerId: attacker.id,
      targetId: target.id,
      damage: attacker.attackPower,
      targetCurrentHp: target.currentHp,
      targetDefeated: !target.isAlive,
    };
  }

  private getSelectedControllableUnit(): Unit | undefined {
    if (!this._selectedUnitId) {
      return undefined;
    }

    const selectedUnit = this.unitsById.get(this._selectedUnitId);
    if (!selectedUnit
      || !selectedUnit.isAlive
      || !this.isMage(selectedUnit)
      || !this.isUnitVisible(selectedUnit)) {
      this._selectedUnitId = null;
      this.clearServantCommandTarget();
      return undefined;
    }

    return this.isMageReady() ? selectedUnit : undefined;
  }

  private getReachablePaths(unit: Unit): ReadonlyMap<string, MovementPath> {
    return this.gameMap.getReachablePaths(
      unit.position,
      unit.movementType,
      this.getRemainingMovementActionPoints(unit),
      (coord) => this.getUnitAt(coord) !== undefined,
      unit.movementRange,
    );
  }

  private hasMovementAvailability(unit: Unit): boolean {
    return this.hasActionPointAvailability(unit, TacticalActionPointCost.Move);
  }

  private hasActionAvailability(unit: Unit): boolean {
    return this.hasActionPointAvailability(unit, TacticalActionPointCost.Attack);
  }

  private getRemainingMovementActionPoints(unit: Unit): number {
    return this.timeline.getRemainingActionPoints(unit.id) ?? noActionPoints;
  }

  private getAvailabilityRejectionReason(
    unit: Unit,
    actionPointCost: TacticalActionPointCost,
  ): Exclude<GameActionRejectionReason, GameActionRejectionReason.NoSelectedUnit> {
    if (!this.isMage(unit)) {
      return GameActionRejectionReason.NotPlayerControlled;
    }

    return !this.isMageReady()
      ? GameActionRejectionReason.NotReady
      : !this.hasActionPointAvailability(unit, actionPointCost)
        ? GameActionRejectionReason.InsufficientActionPoints
        : GameActionRejectionReason.NotReady;
  }

  private hasActionPointAvailability(
    unit: Unit,
    actionPointCost: TacticalActionPointCost,
  ): boolean {
    return this.isMage(unit)
      && this.isMageReady()
      && (this.timeline.getRemainingActionPoints(unit.id) ?? noActionPoints)
        >= actionPointCost;
  }

  private isMage(unit: Unit): boolean {
    return unit.id === this.mageId;
  }

  private isMageReady(): boolean {
    return this.timeline.isReady(this.mageId);
  }

  private isPlayerFactionServant(unit: Unit): boolean {
    return unit.isAlive && unit.faction === Faction.Player && !this.isMage(unit);
  }

  private getSelectedCommandServant(): Unit | undefined {
    if (!this._selectedServantCommandId || !this.getSelectedControllableUnit()) {
      this.clearServantCommandTarget();
      return undefined;
    }

    const servant = this.unitsById.get(this._selectedServantCommandId);
    const rejection = servant
      ? this.getServantCommandRejectionReason(servant)
      : GameActionRejectionReason.NoCommandTarget;
    if (rejection) {
      this.clearServantCommandTarget();
      return undefined;
    }

    return servant;
  }

  private getServantCommandRejectionReason(
    unit: Unit,
  ): Exclude<
    GameActionRejectionReason,
    | GameActionRejectionReason.NoSelectedUnit
    | GameActionRejectionReason.NoCommandTarget
    | GameActionRejectionReason.NoActiveStrategy
  > | undefined {
    if (!this.isMageReady()) {
      return GameActionRejectionReason.NotReady;
    }

    if (!this.isPlayerFactionServant(unit)) {
      return GameActionRejectionReason.NotPlayerControlled;
    }

    if (!this.isUnitVisible(unit)) {
      return GameActionRejectionReason.NotVisible;
    }

    return undefined;
  }

  private getPursueTargetRejection(
    servant: Unit,
    target: Unit,
  ): Exclude<
    GameActionRejectionReason,
    GameActionRejectionReason.NoSelectedUnit
  > | undefined {
    if (!target.isAlive || target.faction !== Faction.Enemy) {
      return GameActionRejectionReason.InvalidEnemyTarget;
    }

    if (!this.isUnitVisible(target)) {
      return GameActionRejectionReason.NotVisible;
    }

    return getFactionDisposition(servant.faction, target.faction)
      === FactionDisposition.Enemy
      ? undefined
      : GameActionRejectionReason.NotHostile;
  }

  private getSecureTargetRejection(
    targetHex: HexCoord,
  ): Exclude<
    GameActionRejectionReason,
    GameActionRejectionReason.NoSelectedUnit
  > | undefined {
    if (!this.gameMap.getField(targetHex.q, targetHex.r)) {
      return GameActionRejectionReason.MissingField;
    }

    return this.getFieldVisibility(targetHex) === FieldVisibility.Visible
      ? undefined
      : GameActionRejectionReason.NotVisible;
  }

  private completeServantStrategyCommand(
    servantId: string,
    strategy: ServantStrategy,
  ): GameAction {
    this.endMageActivationAfterCommand();
    this.clearServantCommandTarget();

    switch (strategy.type) {
      case ServantStrategyType.Hold:
        return {
          type: GameActionType.StrategyAssigned,
          servantId,
          strategyType: strategy.type,
        };
      case ServantStrategyType.PursueDesignatedEnemy:
        return {
          type: GameActionType.StrategyAssigned,
          servantId,
          strategyType: strategy.type,
          targetId: strategy.targetEnemyId,
        };
      case ServantStrategyType.SecureDesignatedHex:
        return {
          type: GameActionType.StrategyAssigned,
          servantId,
          strategyType: strategy.type,
          targetHex: { ...strategy.targetHex },
        };
    }
  }

  /** Existing servant commands remain whole-activation decisions for now. */
  private endMageActivationAfterCommand(): void {
    this.timeline.endReadyActivation(this.mageId);
  }

  private resolveAutonomousActivationsIfActivationEnded(
    unitId: string,
    remainingActionPoints: number,
  ): void {
    if (remainingActionPoints > 0) {
      return;
    }

    this.timeline.endReadyActivation(unitId);
    this.resolveAutonomousActivations();
  }

  private resolveAutonomousAction(
    unitId: string,
    remainingActionPoints: number,
  ): TimelineAction {
    const unit = this.unitsById.get(unitId);
    if (!unit) {
      return TimelineAction.Wait;
    }

    if (unit.faction === Faction.Enemy) {
      return this.resolveEnemyActivation(unit, remainingActionPoints);
    }

    if (!this.isPlayerFactionServant(unit)) {
      return TimelineAction.Wait;
    }

    const strategy = this.servantStrategiesByUnitId.get(unit.id);
    if (!strategy) {
      return this.resolveDefaultServantEngagement(unit, remainingActionPoints);
    }

    switch (strategy.type) {
      case ServantStrategyType.Hold:
        return this.resolveHoldServantStrategy(unit, remainingActionPoints);
      case ServantStrategyType.PursueDesignatedEnemy:
        return this.resolvePursueDesignatedEnemy(
          unit,
          strategy,
          remainingActionPoints,
        );
      case ServantStrategyType.SecureDesignatedHex:
        return this.resolveSecureDesignatedHex(
          unit,
          strategy,
          remainingActionPoints,
        );
    }
  }

  /**
   * A servant without a standing command acquires the first hostile it can
   * currently perceive. The target identity remains private to the domain and
   * is cleared whenever it is no longer valid for autonomous engagement.
   */
  private resolveDefaultServantEngagement(
    servant: Unit,
    remainingActionPoints: number,
  ): TimelineAction {
    const target = this.getDefaultServantEngagementTarget(servant);
    return target
      ? this.resolveServantEngagementTarget(servant, target, remainingActionPoints)
      : TimelineAction.Wait;
  }

  /** Hold prevents pursuit but still allows an adjacent defensive melee attack. */
  private resolveHoldServantStrategy(
    servant: Unit,
    remainingActionPoints: number,
  ): TimelineAction {
    const adjacentHostile = this.findFirstPerceivedHostile(
      servant,
      adjacentHexDistance,
    );
    if (!adjacentHostile || !this.canAffordAutonomousAction(
      remainingActionPoints,
      TacticalActionPointCost.Attack,
    )) {
      return TimelineAction.Wait;
    }

    this.applyMeleeDamage(servant, adjacentHostile, true);
    return TimelineAction.Attack;
  }

  private getDefaultServantEngagementTarget(servant: Unit): Unit | undefined {
    const rememberedTargetId = this.servantTacticalMemory.getDefaultTargetId(servant.id);
    const rememberedTarget = rememberedTargetId
      ? this.unitsById.get(rememberedTargetId)
      : undefined;
    if (rememberedTarget && this.isPerceivedHostile(servant, rememberedTarget)) {
      return rememberedTarget;
    }

    if (rememberedTargetId) {
      this.servantTacticalMemory.clear(servant.id);
    }

    const firstPerceivedHostile = this.findFirstPerceivedHostile(
      servant,
      servant.viewRange,
    );
    if (firstPerceivedHostile) {
      this.servantTacticalMemory.rememberDefaultTarget(
        servant.id,
        firstPerceivedHostile.id,
      );
    }
    return firstPerceivedHostile;
  }

  /** A servant follows only the Mage-designated target identity. */
  private resolvePursueDesignatedEnemy(
    servant: Unit,
    strategy: Extract<
      ServantStrategy,
      { type: ServantStrategyType.PursueDesignatedEnemy }
    >,
    remainingActionPoints: number,
  ): TimelineAction {
    const target = this.unitsById.get(strategy.targetEnemyId);
    if (!target
      || !target.isAlive
      || target.faction !== Faction.Enemy
      || getFactionDisposition(servant.faction, target.faction)
        !== FactionDisposition.Enemy) {
      this.servantStrategiesByUnitId.delete(servant.id);
      return TimelineAction.Wait;
    }

    return this.resolveServantEngagementTarget(servant, target, remainingActionPoints);
  }

  /** Resolves one AP-limited movement or attack against a valid hostile. */
  private resolveServantEngagementTarget(
    servant: Unit,
    target: Unit,
    remainingActionPoints: number,
  ): TimelineAction {
    if (this.gameMap.getHexDistance(servant.position, target.position)
      === adjacentHexDistance) {
      if (!this.canAffordAutonomousAction(
        remainingActionPoints,
        TacticalActionPointCost.Attack,
      )) {
        return TimelineAction.Wait;
      }

      this.applyMeleeDamage(servant, target, true);
      return TimelineAction.Attack;
    }

    const path = this.findShortestApproachPath(servant, target.position);
    if (!path || path.steps.length === 0) {
      return TimelineAction.Wait;
    }

    return this.resolveAutonomousMovement(
      servant,
      path.steps[0],
      remainingActionPoints,
    );
  }

  /**
   * A secure-hex order holds the designated field after arrival. An occupant
   * is never entered; once secured, the servant only defends against adjacent
   * hostiles instead of switching to default pursuit.
   */
  private resolveSecureDesignatedHex(
    servant: Unit,
    strategy: Extract<
      ServantStrategy,
      { type: ServantStrategyType.SecureDesignatedHex }
    >,
    remainingActionPoints: number,
  ): TimelineAction {
    const targetField = this.gameMap.getField(
      strategy.targetHex.q,
      strategy.targetHex.r,
    );
    if (!targetField) {
      this.servantStrategiesByUnitId.delete(servant.id);
      return TimelineAction.Wait;
    }

    if (isSameHex(servant.position, strategy.targetHex)) {
      return this.resolveHoldServantStrategy(servant, remainingActionPoints);
    }

    const targetOccupant = this.getUnitAt(strategy.targetHex);
    if (targetOccupant) {
      if (getFactionDisposition(servant.faction, targetOccupant.faction)
        === FactionDisposition.Enemy
        && this.gameMap.getHexDistance(servant.position, targetOccupant.position)
          === adjacentHexDistance) {
        if (!this.canAffordAutonomousAction(
          remainingActionPoints,
          TacticalActionPointCost.Attack,
        )) {
          return TimelineAction.Wait;
        }

        this.applyMeleeDamage(servant, targetOccupant, true);
        return TimelineAction.Attack;
      }

      return this.moveServantTowardHex(
        servant,
        strategy.targetHex,
        remainingActionPoints,
      );
    }

    const path = this.gameMap.findShortestPathToAny(
      servant.position,
      servant.movementType,
      (coord) => isSameHex(coord, strategy.targetHex),
      (coord) => this.getUnitAt(coord) !== undefined,
    );
    if (!path || path.steps.length === 0) {
      return TimelineAction.Wait;
    }

    return this.resolveAutonomousMovement(
      servant,
      path.steps[0],
      remainingActionPoints,
    );
  }

  /** Resolves the next non-omniscient Enemy action in its current activation. */
  private resolveEnemyActivation(
    enemy: Unit,
    remainingActionPoints: number,
  ): TimelineAction {
    const visibleHostile = this.findNearestVisibleHostile(enemy);
    if (visibleHostile) {
      this.enemyTacticalMemory.rememberHostilePosition(
        enemy.id,
        visibleHostile.id,
        visibleHostile.position,
      );
      if (this.gameMap.getHexDistance(enemy.position, visibleHostile.position)
        === adjacentHexDistance) {
        if (!this.canAffordAutonomousAction(
          remainingActionPoints,
          TacticalActionPointCost.Attack,
        )) {
          return TimelineAction.Wait;
        }

        this.applyMeleeDamage(enemy, visibleHostile, true);
        return TimelineAction.Attack;
      }

      return this.moveEnemyToward(
        enemy,
        visibleHostile.position,
        remainingActionPoints,
      );
    }

    const lastKnownHostilePosition = this.enemyTacticalMemory
      .getLastKnownHostilePosition(enemy.id);
    if (!lastKnownHostilePosition) {
      return TimelineAction.Wait;
    }

    if (isSameHex(enemy.position, lastKnownHostilePosition)) {
      this.enemyTacticalMemory.clear(enemy.id);
      return TimelineAction.Wait;
    }

    return this.moveEnemyToward(
      enemy,
      lastKnownHostilePosition,
      remainingActionPoints,
    );
  }

  private canAffordAutonomousAction(
    remainingActionPoints: number,
    actionPointCost: number,
  ): boolean {
    return remainingActionPoints >= actionPointCost;
  }

  /** Ties use the original level registration order preserved by unitsById. */
  private findNearestVisibleHostile(enemy: Unit): Unit | undefined {
    let nearestHostile: Unit | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of this.unitsById.values()) {
      if (!candidate.isAlive
        || getFactionDisposition(enemy.faction, candidate.faction)
          !== FactionDisposition.Enemy) {
        continue;
      }

      const distance = this.gameMap.getHexDistance(enemy.position, candidate.position);
      if (distance > enemy.viewRange || distance >= nearestDistance) {
        continue;
      }

      nearestHostile = candidate;
      nearestDistance = distance;
    }

    return nearestHostile;
  }

  /**
   * Map insertion order is the stable tie-breaker when more than one hostile
   * is perceived in the same autonomous resolution.
   */
  private findFirstPerceivedHostile(
    observer: Unit,
    maximumDistance: number,
  ): Unit | undefined {
    for (const candidate of this.unitsById.values()) {
      if (this.isPerceivedHostile(observer, candidate)
        && this.gameMap.getHexDistance(observer.position, candidate.position)
          <= maximumDistance) {
        return candidate;
      }
    }

    return undefined;
  }

  private isPerceivedHostile(observer: Unit, candidate: Unit): boolean {
    return candidate.isAlive
      && getFactionDisposition(observer.faction, candidate.faction)
        === FactionDisposition.Enemy
      && this.gameMap.getHexDistance(observer.position, candidate.position)
        <= observer.viewRange;
  }

  /**
   * Makes one legal local step only. Equal candidates use ascending axial q,
   * then ascending r; this keeps paths deterministic without global search.
   */
  private moveEnemyToward(
    enemy: Unit,
    destination: HexCoord,
    remainingActionPoints: number,
  ): TimelineAction {
    const currentDistance = this.gameMap.getHexDistance(enemy.position, destination);
    const candidate = this.gameMap.getNeighbours(enemy.position)
      .map((coord) => ({
        coord,
        traversalCost: this.gameMap.getTraversalCost(
          enemy.position,
          coord,
          enemy.movementType,
        ),
      }))
      .filter((candidate) => candidate.traversalCost !== undefined)
      .filter((candidate) => this.getUnitAt(candidate.coord) === undefined)
      .filter((candidate) => this.gameMap.getHexDistance(candidate.coord, destination)
        < currentDistance)
      .filter((candidate) => this.canAffordAutonomousAction(
        remainingActionPoints,
        candidate.traversalCost!,
      ))
      .sort((first, second) => first.traversalCost! - second.traversalCost!
        || compareHexCoords(first.coord, second.coord))[0];

    if (!candidate) {
      return TimelineAction.Wait;
    }

    return this.resolveAutonomousMovement(
      enemy,
      candidate.coord,
      remainingActionPoints,
    );
  }

  /** Finds a tactical shortest path to any empty, passable hex beside a target. */
  private findShortestApproachPath(
    servant: Unit,
    targetHex: HexCoord,
  ): MovementPath | undefined {
    const approachHexKeys = new Set<string>();
    for (const coord of this.gameMap.getNeighbours(targetHex)) {
      if (this.canUnitOccupy(servant, coord)) {
        approachHexKeys.add(getCoordKey(coord));
      }
    }

    if (approachHexKeys.size === 0) {
      return undefined;
    }

    return this.gameMap.findShortestPathToAny(
      servant.position,
      servant.movementType,
      (coord) => approachHexKeys.has(getCoordKey(coord)),
      (coord) => this.getUnitAt(coord) !== undefined,
    );
  }

  private moveServantTowardHex(
    servant: Unit,
    targetHex: HexCoord,
    remainingActionPoints: number,
  ): TimelineAction {
    const path = this.findShortestApproachPath(servant, targetHex);
    if (!path || path.steps.length === 0) {
      return TimelineAction.Wait;
    }

    return this.resolveAutonomousMovement(
      servant,
      path.steps[0],
      remainingActionPoints,
    );
  }

  private canUnitOccupy(unit: Unit, coord: HexCoord): boolean {
    const field = this.gameMap.getField(coord.q, coord.r);
    return field !== undefined
      && field.getAllowedMovements()[unit.movementType]
      && this.getUnitAt(coord) === undefined;
  }

  private resolveAutonomousMovement(
    unit: Unit,
    destination: HexCoord,
    remainingActionPoints: number,
  ): TimelineAction {
    const traversalCost = this.gameMap.getTraversalCost(
      unit.position,
      destination,
      unit.movementType,
    );
    if (traversalCost === undefined
      || !this.canAffordAutonomousAction(remainingActionPoints, traversalCost)) {
      return TimelineAction.Wait;
    }

    this.moveAutonomousUnit(unit, destination);
    switch (traversalCost) {
      case TacticalActionPointCost.Move:
        return TimelineAction.Move;
      case TacticalActionPointCost.MoveUphill:
        return TimelineAction.MoveUphill;
      default:
        throw new Error(`Unsupported autonomous movement cost: ${traversalCost}`);
    }
  }

  private moveLivingUnit(unit: Unit, destination: HexCoord): void {
    this.unregisterLivingUnit(unit);
    unit.moveTo(destination);
    this.registerLivingUnit(unit);
  }

  private moveAutonomousUnit(unit: Unit, destination: HexCoord): void {
    const from = unit.position;
    this.moveLivingUnit(unit, destination);
    this.publishMovementEvent(unit.id, from, [destination]);
    this.autonomousUnitUpdates.add(unit.id);
  }

  private publishMovementEvent(
    unitId: string,
    from: HexCoord,
    steps: readonly HexCoord[],
  ): void {
    const immutableSteps = Object.freeze(
      steps.map((step) => Object.freeze({ ...step })),
    );
    this.movementEvents.push(Object.freeze({
      unitId,
      from: Object.freeze({ ...from }),
      steps: immutableSteps,
    }));
  }

  private applyMeleeDamage(
    attacker: Unit,
    target: Unit,
    isAutonomousAction: boolean,
  ): void {
    target.receiveDamage(attacker.attackPower);
    if (isAutonomousAction) {
      this.autonomousUnitUpdates.add(attacker.id);
      this.autonomousUnitUpdates.add(target.id);
    }

    if (!target.isAlive) {
      this.unregisterLivingUnit(target);
      this.timeline.invalidateUnit(target.id);
      this.servantStrategiesByUnitId.delete(target.id);
      this.servantTacticalMemory.clear(target.id);
      this.servantTacticalMemory.forgetTarget(target.id);
      this.clearStrategiesPursuingTarget(target.id);
      this.enemyTacticalMemory.clear(target.id);
      this.enemyTacticalMemory.forgetHostile(target.id);
      if (target.id === this.mageId) {
        this.recalculateMageVisibility();
      }
    }
  }

  private clearStrategiesPursuingTarget(targetId: string): void {
    for (const [servantId, strategy] of this.servantStrategiesByUnitId) {
      if (strategy.type === ServantStrategyType.PursueDesignatedEnemy
        && strategy.targetEnemyId === targetId) {
        this.servantStrategiesByUnitId.delete(servantId);
      }
    }
  }

  private clearStaleCommandTarget(): void {
    this.getSelectedCommandServant();
  }

  private clearServantCommandTarget(): void {
    this._selectedServantCommandId = null;
    this._targetSelection = undefined;
  }

  private registerLivingUnit(unit: Unit): void {
    const key = getCoordKey(unit.position);
    const existingUnitId = this.livingUnitIdsByHex.get(key);
    if (existingUnitId) {
      throw new Error(`Living units ${existingUnitId} and ${unit.id} cannot share a hex`);
    }

    this.livingUnitIdsByHex.set(key, unit.id);
  }

  private unregisterLivingUnit(unit: Unit): void {
    const key = getCoordKey(unit.position);
    if (this.livingUnitIdsByHex.get(key) === unit.id) {
      this.livingUnitIdsByHex.delete(key);
    }
  }

  private recalculateMageVisibility(): void {
    const mage = this.unitsById.get(this.mageId);
    if (!mage) {
      throw new Error("The session Mage is missing");
    }

    this.mageVisibility.recalculate(mage);
  }
}

function getCoordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function isSameHex(first: HexCoord, second: HexCoord): boolean {
  return first.q === second.q && first.r === second.r;
}

function compareHexCoords(first: HexCoord, second: HexCoord): number {
  return first.q - second.q || first.r - second.r;
}

function getInitiativeQueueActorLabel(unit: Unit): InitiativeQueueActorLabel {
  if (unit.tacticalRole === UnitTacticalRole.Mage) {
    return InitiativeQueueActorLabel.Mage;
  }

  switch (unit.faction) {
    case Faction.Player:
      return InitiativeQueueActorLabel.Servant;
    case Faction.Enemy:
      return InitiativeQueueActorLabel.Enemy;
    case Faction.Neutral:
      return InitiativeQueueActorLabel.Neutral;
  }
}

const adjacentHexDistance = 1;
const noActionPoints = 0;

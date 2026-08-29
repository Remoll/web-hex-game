import { GameMap, type MovementPath } from "@/game/board/gameMap/GameMap";
import {
  getHexCoordKey,
  isSameHexCoord,
} from "@/game/board/hexCoord/HexCoord";
import {
  AutonomousMemoryDirectiveType,
  resolveAutonomousTacticalDecision,
  type AutonomousMemoryDirective,
  type AutonomousTacticalDecision,
  type AutonomousUnitSnapshot,
} from "@/game/autonomousTacticalResolver/AutonomousTacticalResolver";
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
import { Unit, UnitTacticalRole, type UnitTexture } from "@/game/unit/Unit";
import {
  holdServantStrategy,
  protectMageServantStrategy,
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
  | {
    type: GameActionType.StrategyAssigned;
    servantId: string;
    strategyType: ServantStrategyType.ProtectMage;
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

/** Stable visual event kinds emitted by resolved tactical actions. */
export enum TacticalPresentationEventKind {
  Move = "move",
  Attack = "attack",
}

/**
 * Immutable, renderer-neutral state at one resolved tactical event boundary.
 * It is deliberately limited to data needed to play an already-visible unit.
 */
export interface TacticalUnitPresentation {
  readonly id: string;
  readonly position: Readonly<HexCoord>;
  readonly texture: UnitTexture;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly isAlive: boolean;
}

/**
 * An immutable presentation event emitted after a legal domain movement.
 * `steps` excludes `from` and preserves the legal path's original order.
 */
export interface UnitMovementEvent {
  readonly kind: TacticalPresentationEventKind.Move;
  readonly unit: TacticalUnitPresentation;
  readonly from: Readonly<HexCoord>;
  readonly steps: readonly Readonly<HexCoord>[];
}

/** A safe snapshot of the health/remains state resulting from one melee hit. */
export interface UnitAttackEvent {
  readonly kind: TacticalPresentationEventKind.Attack;
  readonly attacker: TacticalUnitPresentation;
  readonly target: TacticalUnitPresentation;
}

/** Ordered renderer-facing playback stream; it never grants mutation authority. */
export type TacticalPresentationEvent = UnitMovementEvent | UnitAttackEvent;

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
  readonly canAssignProtect: boolean;
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
  private readonly tacticalPresentationEvents: TacticalPresentationEvent[] = [];
  private requiresTacticalVisibilitySync = false;
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
    const canSpendServantStrategyCommand = this.canMageAffordServantStrategyCommand();
    const canAssignStrategy = target !== undefined
      && !isSelectingStrategyTarget
      && canSpendServantStrategyCommand;

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
      canAssignHold: canAssignStrategy
        && strategy?.type !== ServantStrategyType.Hold,
      canAssignPursue: canAssignStrategy,
      canAssignSecure: canAssignStrategy,
      canAssignProtect: canAssignStrategy
        && strategy?.type !== ServantStrategyType.ProtectMage,
      canClearStrategy: isSelectingStrategyTarget
        || (strategy !== undefined && canSpendServantStrategyCommand),
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

  /** Exposes only a servant's active strategy kind, never private target data. */
  getServantStrategyType(servantId: string): ServantStrategyType | undefined {
    return this.servantStrategiesByUnitId.get(servantId)?.type;
  }

  /**
   * Simulation state for tests and future AI orchestration. Player-facing
   * presentation must not render this private Enemy memory outside Mage sight.
   */
  getEnemyLastKnownHostilePosition(enemyId: string): HexCoord | undefined {
    return this.enemyTacticalMemory.getLastKnownHostilePosition(enemyId);
  }

  /**
   * Returns immutable, fog-safe visual events in the exact order their domain
   * actions resolved. The simulation has already reached authoritative state.
   */
  consumeTacticalPresentationEvents(): readonly TacticalPresentationEvent[] {
    const events = Object.freeze(
      this.tacticalPresentationEvents.filter((event) =>
        this.isTacticalPresentationEventSafe(event),
      ),
    );
    this.tacticalPresentationEvents.length = 0;
    return events;
  }

  /**
   * Signals that a completed tactical action changed board presentation state.
   * It contains no unit identity or coordinate, so callers can safely refresh
   * current fog and hide stale visuals when no event remains visible.
   */
  consumeTacticalVisibilitySyncSignal(): boolean {
    const requiresSync = this.requiresTacticalVisibilitySync;
    this.requiresTacticalVisibilitySync = false;
    return requiresSync;
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
    const unitId = this.livingUnitIdsByHex.get(getHexCoordKey(coord));
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

    if (isSameHexCoord(selectedUnit.position, coord)) {
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

    const path = this.getReachablePaths(selectedUnit).get(getHexCoordKey(coord));
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
    this.reconcileTacticalSelection();

    if (!this.gameMap.getField(coord.q, coord.r)) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.MissingField,
      };
    }

    const selectedUnit = this.getSelectedControllableUnit();
    if (selectedUnit
      && this._targetSelection === undefined
      && isSameHexCoord(selectedUnit.position, coord)) {
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
    this.reconcileTacticalSelection();
    const servant = this.getSelectedCommandServant();
    return servant
      ? this.assignHoldStrategyToServant(servant.id)
      : {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
  }

  /** Assigns the selected servant to defend the session-owned Mage. */
  assignProtectMageStrategy(): GameAction {
    this.reconcileTacticalSelection();
    const servant = this.getSelectedCommandServant();
    return servant
      ? this.assignProtectMageStrategyToServant(servant.id)
      : {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
  }

  /** Starts an explicit board-target selection without spending Mage Tempo. */
  beginPursueDesignatedEnemySelection(): GameAction {
    this.reconcileTacticalSelection();
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
    this.reconcileTacticalSelection();
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
    this.reconcileTacticalSelection();
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

    const rejection = this.getServantCommandRejectionReason(servant)
      ?? this.getServantStrategyCommandCostRejectionReason();
    if (rejection) {
      return {
        type: GameActionType.Ignored,
        reason: rejection,
      };
    }

    if (this.servantStrategiesByUnitId.get(servant.id)?.type
      === ServantStrategyType.Hold) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.StrategyUnchanged,
      };
    }

    this.servantStrategiesByUnitId.set(servant.id, holdServantStrategy);
    return this.completeServantStrategyCommand(servant.id, holdServantStrategy);
  }

  /** Assigns a 1-AP standing order that follows and defends the Mage. */
  assignProtectMageStrategyToServant(servantId: string): GameAction {
    const servant = this.unitsById.get(servantId);
    if (!servant) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
    }

    const rejection = this.getServantCommandRejectionReason(servant)
      ?? this.getServantStrategyCommandCostRejectionReason();
    if (rejection) {
      return {
        type: GameActionType.Ignored,
        reason: rejection,
      };
    }

    if (this.servantStrategiesByUnitId.get(servant.id)?.type
      === ServantStrategyType.ProtectMage) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.StrategyUnchanged,
      };
    }

    this.servantStrategiesByUnitId.set(servant.id, protectMageServantStrategy);
    return this.completeServantStrategyCommand(
      servant.id,
      protectMageServantStrategy,
    );
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

    const servantRejection = this.getServantCommandRejectionReason(servant)
      ?? this.getServantStrategyCommandCostRejectionReason();
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

    const servantRejection = this.getServantCommandRejectionReason(servant)
      ?? this.getServantStrategyCommandCostRejectionReason();
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
      && isSameHexCoord(existingStrategy.targetHex, targetHex)) {
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

    const rejection = this.getServantCommandRejectionReason(servant)
      ?? this.getServantStrategyCommandCostRejectionReason();
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
    this.spendServantStrategyCommandActionPoints();
    return { type: GameActionType.StrategyCleared, servantId: servant.id };
  }

  /**
   * Resolves all non-Mage activations up to the next Mage decision. Calling it
   * repeatedly at a Mage decision is a no-op, preventing duplicate dispatch.
   */
  resolveAutonomousActivations(): void {
    if (this.isMageReady()) {
      this.reconcileTacticalSelection();
      return;
    }

    this.timeline.advanceAutonomousUnitsToMageDecision(
      this.mageId,
      (participant, remainingActionPoints) => this.resolveAutonomousAction(
        participant.id,
        remainingActionPoints,
      ),
    );
    this.reconcileTacticalSelection();
  }

  /** Defers the ready Mage once without spending Action Points. */
  waitForMage(): GameAction {
    this.reconcileTacticalSelection();
    const mage = this.unitsById.get(this.mageId);
    if (!mage || !mage.isAlive || !this.timeline.isReady(mage.id)) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NotReady,
      };
    }

    if (this.timeline.hasWaitedDuringReadyActivation(mage.id)) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NotReady,
      };
    }

    this.timeline.deferReadyActivation(mage.id);
    this.clearServantCommandTarget();
    this.resolveAutonomousActivations();
    return { type: GameActionType.Waited, unitId: mage.id };
  }

  /** Ends the ready Mage activation and discards its remaining Action Points. */
  endMageTurn(): GameAction {
    this.reconcileTacticalSelection();
    const mage = this.unitsById.get(this.mageId);
    if (!mage || !mage.isAlive || !this.timeline.isReady(mage.id)) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NotReady,
      };
    }

    this.timeline.endReadyActivation(mage.id);
    this.clearServantCommandTarget();
    this.resolveAutonomousActivations();
    return { type: GameActionType.TurnEnded, unitId: mage.id };
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
    if (unit.id === this.mageId) {
      this.recalculateMageVisibility();
      this.clearServantCommandTarget();
    }
    this.publishMovementEvent(unit, from, preview.path.steps);
    if (unit.id === this.mageId) {
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

    this.applyMeleeDamage(attacker, target);
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
    const selectedUnit = this.getSelectedMage();

    return this.isMageReady() ? selectedUnit : undefined;
  }

  /** Pure selection validation used by input previews and presentation reads. */
  private getSelectedMage(): Unit | undefined {
    if (!this._selectedUnitId) {
      return undefined;
    }

    const selectedUnit = this.unitsById.get(this._selectedUnitId);
    return selectedUnit
      && selectedUnit.isAlive
      && this.isMage(selectedUnit)
      && this.isUnitVisible(selectedUnit)
      ? selectedUnit
      : undefined;
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
      return undefined;
    }

    const servant = this.unitsById.get(this._selectedServantCommandId);
    const rejection = servant
      ? this.getServantCommandRejectionReason(servant)
      : GameActionRejectionReason.NoCommandTarget;
    if (rejection) {
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

  private getServantStrategyCommandCostRejectionReason(): (
    | GameActionRejectionReason.NotReady
    | GameActionRejectionReason.InsufficientActionPoints
    | undefined
  ) {
    return this.canMageAffordServantStrategyCommand()
      ? undefined
      : this.isMageReady()
        ? GameActionRejectionReason.InsufficientActionPoints
        : GameActionRejectionReason.NotReady;
  }

  private canMageAffordServantStrategyCommand(): boolean {
    const mage = this.unitsById.get(this.mageId);
    return mage !== undefined && this.hasActionPointAvailability(
      mage,
      TacticalActionPointCost.ServantStrategyCommand,
    );
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
    this.spendServantStrategyCommandActionPoints();

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
      case ServantStrategyType.ProtectMage:
        return {
          type: GameActionType.StrategyAssigned,
          servantId,
          strategyType: strategy.type,
        };
    }
  }

  /** Spends a named order cost and resolves only if it exhausts the Mage. */
  private spendServantStrategyCommandActionPoints(): void {
    const remainingActionPoints = this.timeline.spendReadyActionPoints(
      this.mageId,
      TacticalActionPointCost.ServantStrategyCommand,
    );
    this._targetSelection = undefined;
    if (remainingActionPoints === noActionPoints) {
      this.clearServantCommandTarget();
    }
    this.resolveAutonomousActivationsIfActivationEnded(
      this.mageId,
      remainingActionPoints,
    );
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

    const snapshots = this.getAutonomousUnitSnapshots();
    const decision = resolveAutonomousTacticalDecision({
      gameMap: this.gameMap,
      units: snapshots.units,
      unitsById: snapshots.unitsById,
      livingUnitIdByHex: this.livingUnitIdsByHex,
      actorId: unit.id,
      mageId: this.mageId,
      remainingActionPoints,
      enemyMemory: {
        lastKnownHostilePosition: this.enemyTacticalMemory
          .getLastKnownHostilePosition(unit.id),
      },
      servantMemory: {
        defaultTargetId: this.servantTacticalMemory.getDefaultTargetId(unit.id),
      },
      servantStrategy: this.servantStrategiesByUnitId.get(unit.id),
    });

    return this.applyAutonomousTacticalDecision(
      unit,
      remainingActionPoints,
      decision,
    );
  }

  private getAutonomousUnitSnapshots(): AutonomousUnitSnapshots {
    const units: AutonomousUnitSnapshot[] = [];
    const unitsById = new Map<string, AutonomousUnitSnapshot>();

    for (const unit of this.unitsById.values()) {
      const snapshot: AutonomousUnitSnapshot = {
        id: unit.id,
        faction: unit.faction,
        movementType: unit.movementType,
        tacticalRole: unit.tacticalRole,
        viewRange: unit.viewRange,
        isAlive: unit.isAlive,
        position: unit.position,
      };
      units.push(snapshot);
      unitsById.set(snapshot.id, snapshot);
    }

    return { units, unitsById };
  }

  private applyAutonomousTacticalDecision(
    unit: Unit,
    remainingActionPoints: number,
    decision: AutonomousTacticalDecision,
  ): TimelineAction {
    this.applyAutonomousMemoryDirectives(unit.id, decision.memoryDirectives);
    if (decision.clearServantStrategy) {
      this.servantStrategiesByUnitId.delete(unit.id);
    }

    switch (decision.action) {
      case TimelineAction.Wait:
        return TimelineAction.Wait;
      case TimelineAction.Attack: {
        const target = this.unitsById.get(decision.targetId);
        if (!target || !this.canApplyAutonomousAttack(
          unit,
          target,
          remainingActionPoints,
        )) {
          return TimelineAction.Wait;
        }

        this.applyMeleeDamage(unit, target);
        return TimelineAction.Attack;
      }
      case TimelineAction.Move:
      case TimelineAction.MoveUphill:
        return this.applyAutonomousMovementDecision(
          unit,
          remainingActionPoints,
          decision,
        );
    }
  }

  private applyAutonomousMovementDecision(
    unit: Unit,
    remainingActionPoints: number,
    decision: Extract<
      AutonomousTacticalDecision,
      { action: TimelineAction.Move | TimelineAction.MoveUphill }
    >,
  ): TimelineAction {
    const traversalCost = this.gameMap.getTraversalCost(
      unit.position,
      decision.destination,
      unit.movementType,
    );
    if (traversalCost === undefined
      || traversalCost > remainingActionPoints
      || this.getUnitAt(decision.destination) !== undefined
      || (traversalCost === TacticalActionPointCost.Move
        && decision.action !== TimelineAction.Move)
      || (traversalCost === TacticalActionPointCost.MoveUphill
        && decision.action !== TimelineAction.MoveUphill)) {
      return TimelineAction.Wait;
    }

    this.moveAutonomousUnit(unit, decision.destination);
    return decision.action;
  }

  /** The resolver proposes attacks; GameSession owns their final legality. */
  private canApplyAutonomousAttack(
    attacker: Unit,
    target: Unit,
    remainingActionPoints: number,
  ): boolean {
    return attacker.isAlive
      && target.isAlive
      && remainingActionPoints >= TacticalActionPointCost.Attack
      && this.gameMap.getHexDistance(attacker.position, target.position) === 1
      && getFactionDisposition(attacker.faction, target.faction)
        === FactionDisposition.Enemy;
  }

  private applyAutonomousMemoryDirectives(
    unitId: string,
    directives: readonly AutonomousMemoryDirective[],
  ): void {
    for (const directive of directives) {
      switch (directive.type) {
        case AutonomousMemoryDirectiveType.RememberEnemyHostile:
          this.enemyTacticalMemory.rememberHostilePosition(
            unitId,
            directive.hostileId,
            directive.position,
          );
          break;
        case AutonomousMemoryDirectiveType.ClearEnemyMemory:
          this.enemyTacticalMemory.clear(unitId);
          break;
        case AutonomousMemoryDirectiveType.RememberServantDefaultTarget:
          this.servantTacticalMemory.rememberDefaultTarget(
            unitId,
            directive.targetId,
          );
          break;
        case AutonomousMemoryDirectiveType.ClearServantDefaultTarget:
          this.servantTacticalMemory.clear(unitId);
          break;
      }
    }
  }

  private moveLivingUnit(unit: Unit, destination: HexCoord): void {
    this.unregisterLivingUnit(unit);
    unit.moveTo(destination);
    this.registerLivingUnit(unit);
    this.requiresTacticalVisibilitySync = true;
  }

  private moveAutonomousUnit(unit: Unit, destination: HexCoord): void {
    const from = unit.position;
    this.moveLivingUnit(unit, destination);
    this.publishMovementEvent(unit, from, [destination]);
  }

  private publishMovementEvent(
    unit: Unit,
    from: HexCoord,
    steps: readonly HexCoord[],
  ): void {
    if (!this.isUnitVisible(unit)) {
      return;
    }

    const immutableSteps = Object.freeze(
      steps.map((step) => Object.freeze({ ...step })),
    );
    this.tacticalPresentationEvents.push(Object.freeze({
      kind: TacticalPresentationEventKind.Move,
      unit: this.createTacticalUnitPresentation(unit),
      from: Object.freeze({ ...from }),
      steps: immutableSteps,
    }));
  }

  private applyMeleeDamage(
    attacker: Unit,
    target: Unit,
  ): void {
    const canPresentAttack = this.isUnitVisible(attacker)
      && this.isUnitVisible(target);
    target.receiveDamage(attacker.attackPower);
    this.requiresTacticalVisibilitySync = true;
    if (canPresentAttack) {
      this.publishAttackEvent(attacker, target);
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
        this.clearStrategiesProtectingMage();
        this.recalculateMageVisibility();
      }
    }
  }

  private publishAttackEvent(attacker: Unit, target: Unit): void {
    this.tacticalPresentationEvents.push(Object.freeze({
      kind: TacticalPresentationEventKind.Attack,
      attacker: this.createTacticalUnitPresentation(attacker),
      target: this.createTacticalUnitPresentation(target),
    }));
  }

  private createTacticalUnitPresentation(unit: Unit): TacticalUnitPresentation {
    return Object.freeze({
      id: unit.id,
      position: Object.freeze(unit.position),
      texture: unit.texture,
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
      isAlive: unit.isAlive,
    });
  }

  private isTacticalPresentationEventSafe(event: TacticalPresentationEvent): boolean {
    switch (event.kind) {
      case TacticalPresentationEventKind.Move:
        return this.isTacticalUnitPresentationSafe(event.unit)
          && this.isVisiblePresentationCoord(event.from)
          && event.steps.every((step) => this.isVisiblePresentationCoord(step));
      case TacticalPresentationEventKind.Attack:
        return this.isTacticalUnitPresentationSafe(event.attacker)
          && this.isTacticalUnitPresentationSafe(event.target);
    }
  }

  private isTacticalUnitPresentationSafe(
    presentation: TacticalUnitPresentation,
  ): boolean {
    const unit = this.unitsById.get(presentation.id);
    return unit !== undefined
      && this.isUnitVisible(unit)
      && this.isVisiblePresentationCoord(presentation.position);
  }

  private isVisiblePresentationCoord(coord: Readonly<HexCoord>): boolean {
    return this.getFieldVisibility(coord) === FieldVisibility.Visible;
  }

  private clearStrategiesPursuingTarget(targetId: string): void {
    for (const [servantId, strategy] of this.servantStrategiesByUnitId) {
      if (strategy.type === ServantStrategyType.PursueDesignatedEnemy
        && strategy.targetEnemyId === targetId) {
        this.servantStrategiesByUnitId.delete(servantId);
      }
    }
  }

  private clearStrategiesProtectingMage(): void {
    for (const [servantId, strategy] of this.servantStrategiesByUnitId) {
      if (strategy.type === ServantStrategyType.ProtectMage) {
        this.servantStrategiesByUnitId.delete(servantId);
      }
    }
  }

  /** Reconciles invalid stored selection only during explicit game transitions. */
  private reconcileTacticalSelection(): void {
    const selectedMage = this.getSelectedMage();
    if (!selectedMage) {
      this._selectedUnitId = null;
      this.clearServantCommandTarget();
      return;
    }

    if (!this.isMageReady() || !this.getSelectedCommandServant()) {
      this.clearServantCommandTarget();
    }
  }

  private clearServantCommandTarget(): void {
    this._selectedServantCommandId = null;
    this._targetSelection = undefined;
  }

  private registerLivingUnit(unit: Unit): void {
    const key = getHexCoordKey(unit.position);
    const existingUnitId = this.livingUnitIdsByHex.get(key);
    if (existingUnitId) {
      throw new Error(`Living units ${existingUnitId} and ${unit.id} cannot share a hex`);
    }

    this.livingUnitIdsByHex.set(key, unit.id);
  }

  private unregisterLivingUnit(unit: Unit): void {
    const key = getHexCoordKey(unit.position);
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

interface AutonomousUnitSnapshots {
  readonly units: readonly AutonomousUnitSnapshot[];
  readonly unitsById: ReadonlyMap<string, AutonomousUnitSnapshot>;
}

const noActionPoints = 0;

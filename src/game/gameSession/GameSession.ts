import { GameMap, type MovementPath } from "@/game/board/gameMap/GameMap";
import {
  Faction,
  FactionDisposition,
  getFactionDisposition,
} from "@/game/faction/Faction";
import {
  EventTimeline,
  TimelineAction,
  type EventTimelineReader,
  type TimelinePresentation,
} from "@/game/eventTimeline/EventTimeline";
import { EnemyTacticalMemory } from "@/game/enemyAi/EnemyTacticalMemory";
import { Unit, UnitTacticalRole } from "@/game/unit/Unit";
import {
  holdServantStrategy,
  pursueDesignatedEnemyStrategy,
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
  Moved = "moved",
  Attacked = "attacked",
  StrategyAssigned = "strategy-assigned",
  StrategyCleared = "strategy-cleared",
  Waited = "waited",
  Ignored = "ignored",
}

export enum GameActionPreviewType {
  Selection = "selection",
  ServantCommandSelection = "servant-command-selection",
  PursuitTargetSelection = "pursuit-target-selection",
  ValidMove = "valid-move",
  ValidAttack = "valid-attack",
  OutOfRange = "out-of-range",
}

export enum GameActionRejectionReason {
  MissingField = "missing-field",
  NoSelectedUnit = "no-selected-unit",
  NotPlayerControlled = "not-player-controlled",
  NotHostile = "not-hostile",
  NotVisible = "not-visible",
  NotReady = "not-ready",
  NoCommandTarget = "no-command-target",
  NoActiveStrategy = "no-active-strategy",
  InvalidEnemyTarget = "invalid-enemy-target",
  StrategyUnchanged = "strategy-unchanged",
  OutOfRange = "out-of-range",
}

export type GameAction =
  | { type: GameActionType.Selected; unitId: string }
  | { type: GameActionType.Deselected; unitId: string }
  | { type: GameActionType.ServantCommandTargetSelected; servantId: string }
  | { type: GameActionType.PursuitTargetSelectionStarted; servantId: string }
  | { type: GameActionType.PursuitTargetSelectionCancelled; servantId: string }
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
  | { type: GameActionType.StrategyCleared; servantId: string }
  | { type: GameActionType.Waited; unitId: string }
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

/** Safe UI state: it exposes only the currently visible command target. */
export interface ServantCommandPresentation {
  readonly targetServantId: string | undefined;
  readonly targetStrategyType: ServantStrategyType | undefined;
  /** Exposed only while the designated Enemy remains currently visible. */
  readonly visiblePursuitTargetId: string | undefined;
  readonly canAssignHold: boolean;
  readonly canAssignPursue: boolean;
  readonly canClearStrategy: boolean;
  readonly isSelectingPursuitTarget: boolean;
}

/** Owns mutable game state without depending on rendering or browser APIs. */
export class GameSession {
  private readonly unitsById = new Map<string, Unit>();
  private readonly livingUnitIdsByHex = new Map<string, string>();
  private readonly mageId: string;
  private readonly mageVisibility: MageVisibility;
  private readonly timeline: EventTimeline;
  private readonly enemyTacticalMemory = new EnemyTacticalMemory();
  private readonly servantStrategiesByUnitId = new Map<string, ServantStrategy>();
  private readonly autonomousUnitUpdates = new Set<string>();
  private _selectedUnitId: string | null = null;
  private _selectedServantCommandId: string | null = null;
  private _isSelectingPursuitTarget = false;

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
    const isSelectingPursuitTarget = target !== undefined
      && this._isSelectingPursuitTarget;

    return {
      targetServantId: target?.id,
      targetStrategyType: strategy?.type,
      visiblePursuitTargetId: pursuitTarget?.isAlive
        && this.isUnitVisible(pursuitTarget)
        ? pursuitTarget.id
        : undefined,
      canAssignHold: target !== undefined && !isSelectingPursuitTarget,
      canAssignPursue: target !== undefined && !isSelectingPursuitTarget,
      canClearStrategy: strategy !== undefined || isSelectingPursuitTarget,
      isSelectingPursuitTarget,
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

    if (this._isSelectingPursuitTarget) {
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
          reason: this.getAvailabilityRejectionReason(selectedUnit),
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
        reason: this.getAvailabilityRejectionReason(selectedUnit),
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
    if (selectedUnit && isSameHex(selectedUnit.position, coord)) {
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
        this._isSelectingPursuitTarget = false;
        return {
          type: GameActionType.ServantCommandTargetSelected,
          servantId: preview.servantId,
        };
      case GameActionPreviewType.PursuitTargetSelection:
        return this.assignPursueDesignatedEnemyStrategyToServant(
          preview.servantId,
          preview.targetId,
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

    this._isSelectingPursuitTarget = true;
    return {
      type: GameActionType.PursuitTargetSelectionStarted,
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

    if (this._isSelectingPursuitTarget) {
      this._isSelectingPursuitTarget = false;
      return {
        type: GameActionType.PursuitTargetSelectionCancelled,
        servantId: servant.id,
      };
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
    return this.completeServantStrategyCommand(
      servant.id,
      holdServantStrategy.type,
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
      this._isSelectingPursuitTarget = false;
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.StrategyUnchanged,
      };
    }

    this.servantStrategiesByUnitId.set(
      servant.id,
      pursueDesignatedEnemyStrategy(target.id),
    );
    return this.completeServantStrategyCommand(
      servant.id,
      ServantStrategyType.PursueDesignatedEnemy,
      target.id,
    );
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
    this.timeline.consumeReadyAction(this.mageId, TimelineAction.Command);
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
      (participant) => this.resolveAutonomousAction(participant.id),
    );
    this.clearStaleCommandTarget();
  }

  /**
   * Ends the Mage's current activation without changing board state. Autonomous
   * units resolve synchronously until the next deterministic Mage decision.
   */
  waitForMage(): GameAction {
    const mage = this.unitsById.get(this.mageId);
    if (!mage || !mage.isAlive || !this.timeline.isReady(mage.id)) {
      return {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NotReady,
      };
    }

    this.timeline.consumeReadyAction(mage.id, TimelineAction.Wait);
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
    this.timeline.consumeReadyAction(unit.id, TimelineAction.Move);

    const from = unit.position;
    this.moveLivingUnit(unit, preview.destination);
    if (unit.id === this.mageId) {
      this.recalculateMageVisibility();
      this.clearServantCommandTarget();
      this.resolveAutonomousActivations();
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
    this.timeline.consumeReadyAction(attacker.id, TimelineAction.Attack);
    this.clearServantCommandTarget();

    this.applyMeleeDamage(attacker, target, false);
    this.resolveAutonomousActivations();

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
      this.getMovementRangeForCurrentAction(unit),
      (coord) => this.getUnitAt(coord) !== undefined,
    );
  }

  private hasMovementAvailability(unit: Unit): boolean {
    return this.isMage(unit) && this.isMageReady();
  }

  private hasActionAvailability(unit: Unit): boolean {
    return this.isMage(unit) && this.isMageReady();
  }

  private getMovementRangeForCurrentAction(unit: Unit): number {
    return unit.movementRange;
  }

  private getAvailabilityRejectionReason(
    unit: Unit,
  ): Exclude<GameActionRejectionReason, GameActionRejectionReason.NoSelectedUnit> {
    return this.isMage(unit)
      ? GameActionRejectionReason.NotReady
      : GameActionRejectionReason.NotPlayerControlled;
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

  private completeServantStrategyCommand(
    servantId: string,
    strategyType: ServantStrategyType,
    targetId?: string,
  ): GameAction {
    this.timeline.consumeReadyAction(this.mageId, TimelineAction.Command);
    this.clearServantCommandTarget();

    switch (strategyType) {
      case ServantStrategyType.Hold:
      return {
        type: GameActionType.StrategyAssigned,
        servantId,
        strategyType,
      };
      case ServantStrategyType.PursueDesignatedEnemy:
        if (!targetId) {
          throw new Error("Pursue strategy assignments require a target Enemy id");
        }
        return {
          type: GameActionType.StrategyAssigned,
          servantId,
          strategyType,
          targetId,
        };
    }
  }

  private resolveAutonomousAction(unitId: string): TimelineAction {
    const unit = this.unitsById.get(unitId);
    if (!unit) {
      return TimelineAction.Wait;
    }

    if (unit.faction === Faction.Enemy) {
      return this.resolveEnemyActivation(unit);
    }

    if (!this.isPlayerFactionServant(unit)) {
      return TimelineAction.Wait;
    }

    const strategy = this.servantStrategiesByUnitId.get(unit.id);
    if (!strategy) {
      return TimelineAction.Wait;
    }

    switch (strategy.type) {
      case ServantStrategyType.Hold:
        return TimelineAction.Wait;
      case ServantStrategyType.PursueDesignatedEnemy:
        return this.resolvePursueDesignatedEnemy(unit, strategy);
    }
  }

  /** A servant follows only the Mage-designated target identity. */
  private resolvePursueDesignatedEnemy(
    servant: Unit,
    strategy: Extract<
      ServantStrategy,
      { type: ServantStrategyType.PursueDesignatedEnemy }
    >,
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

    if (this.gameMap.getHexDistance(servant.position, target.position)
      === adjacentHexDistance) {
      this.applyMeleeDamage(servant, target, true);
      return TimelineAction.Attack;
    }

    const path = this.findShortestPursuitPath(servant, target);
    if (!path || path.steps.length === 0) {
      return TimelineAction.Wait;
    }

    this.moveAutonomousUnit(servant, path.steps[0]);
    return TimelineAction.Move;
  }

  /** Resolves exactly one non-omniscient Enemy action for its timeline event. */
  private resolveEnemyActivation(enemy: Unit): TimelineAction {
    const visibleHostile = this.findNearestVisibleHostile(enemy);
    if (visibleHostile) {
      this.enemyTacticalMemory.rememberHostilePosition(
        enemy.id,
        visibleHostile.id,
        visibleHostile.position,
      );
      if (this.gameMap.getHexDistance(enemy.position, visibleHostile.position)
        === adjacentHexDistance) {
        this.applyMeleeDamage(enemy, visibleHostile, true);
        return TimelineAction.Attack;
      }

      return this.moveEnemyToward(enemy, visibleHostile.position)
        ? TimelineAction.Move
        : TimelineAction.Wait;
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

    return this.moveEnemyToward(enemy, lastKnownHostilePosition)
      ? TimelineAction.Move
      : TimelineAction.Wait;
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
   * Makes one legal local step only. Equal candidates use ascending axial q,
   * then ascending r; this keeps paths deterministic without global search.
   */
  private moveEnemyToward(enemy: Unit, destination: HexCoord): boolean {
    const currentDistance = this.gameMap.getHexDistance(enemy.position, destination);
    const candidate = this.gameMap.getNeighbours(enemy.position)
      .filter((coord) => this.canUnitEnter(enemy, coord))
      .filter((coord) => this.gameMap.getHexDistance(coord, destination) < currentDistance)
      .sort(compareHexCoords)[0];

    if (!candidate) {
      return false;
    }

    this.moveAutonomousUnit(enemy, candidate);
    return true;
  }

  /** Finds a tactical shortest path to any empty, passable hex beside a target. */
  private findShortestPursuitPath(
    servant: Unit,
    target: Unit,
  ): MovementPath | undefined {
    const approachHexKeys = new Set<string>();
    for (const coord of this.gameMap.getNeighbours(target.position)) {
      if (this.canUnitEnter(servant, coord)) {
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

  private canUnitEnter(unit: Unit, coord: HexCoord): boolean {
    const field = this.gameMap.getField(coord.q, coord.r);
    return field !== undefined
      && field.getAllowedMovements()[unit.movementType]
      && this.getUnitAt(coord) === undefined;
  }

  private moveLivingUnit(unit: Unit, destination: HexCoord): void {
    this.unregisterLivingUnit(unit);
    unit.moveTo(destination);
    this.registerLivingUnit(unit);
  }

  private moveAutonomousUnit(unit: Unit, destination: HexCoord): void {
    this.moveLivingUnit(unit, destination);
    this.autonomousUnitUpdates.add(unit.id);
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
    this._isSelectingPursuitTarget = false;
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

const adjacentHexDistance = 1;

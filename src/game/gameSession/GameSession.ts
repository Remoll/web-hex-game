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
  OutOfRange = "out-of-range",
}

export type GameAction =
  | { type: GameActionType.Selected; unitId: string }
  | { type: GameActionType.Deselected; unitId: string }
  | { type: GameActionType.ServantCommandTargetSelected; servantId: string }
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
    strategyType: ServantStrategyType;
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
  readonly canAssignHold: boolean;
  readonly canClearStrategy: boolean;
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

    return {
      targetServantId: target?.id,
      targetStrategyType: strategy?.type,
      canAssignHold: target !== undefined,
      canClearStrategy: strategy !== undefined,
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
      this._selectedServantCommandId = null;
      return { type: GameActionType.Deselected, unitId: selectedUnit.id };
    }

    const preview = this.previewHex(coord);
    switch (preview.type) {
      case GameActionPreviewType.Selection:
        this._selectedUnitId = preview.unitId;
        this._selectedServantCommandId = null;
        return { type: GameActionType.Selected, unitId: preview.unitId };
      case GameActionPreviewType.ServantCommandSelection:
        this._selectedServantCommandId = preview.servantId;
        return {
          type: GameActionType.ServantCommandTargetSelected,
          servantId: preview.servantId,
        };
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

  /** Clears the current strategy from the selected visible servant. */
  clearServantStrategy(): GameAction {
    const servant = this.getSelectedCommandServant();
    return servant
      ? this.clearServantStrategyFromServant(servant.id)
      : {
        type: GameActionType.Ignored,
        reason: GameActionRejectionReason.NoCommandTarget,
      };
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
      GameActionType.StrategyAssigned,
      holdServantStrategy.type,
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
    return this.completeServantStrategyCommand(
      servant.id,
      GameActionType.StrategyCleared,
    );
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
      this._selectedServantCommandId = null;
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
      this._selectedServantCommandId = null;
      return undefined;
    }

    const servant = this.unitsById.get(this._selectedServantCommandId);
    const rejection = servant
      ? this.getServantCommandRejectionReason(servant)
      : GameActionRejectionReason.NoCommandTarget;
    if (rejection) {
      this._selectedServantCommandId = null;
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

  private completeServantStrategyCommand(
    servantId: string,
    actionType: GameActionType.StrategyAssigned | GameActionType.StrategyCleared,
    strategyType?: ServantStrategyType,
  ): GameAction {
    this.timeline.consumeReadyAction(this.mageId, TimelineAction.Command);
    this.clearServantCommandTarget();

    if (actionType === GameActionType.StrategyAssigned) {
      if (!strategyType) {
        throw new Error("Assigned servant strategies require a strategy type");
      }

      return {
        type: actionType,
        servantId,
        strategyType,
      };
    }

    return { type: actionType, servantId };
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
    }

    return TimelineAction.Wait;
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

    this.moveLivingUnit(enemy, candidate);
    this.autonomousUnitUpdates.add(enemy.id);
    return true;
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
      this.enemyTacticalMemory.clear(target.id);
      this.enemyTacticalMemory.forgetHostile(target.id);
      if (target.id === this.mageId) {
        this.recalculateMageVisibility();
      }
    }
  }

  private clearStaleCommandTarget(): void {
    this.getSelectedCommandServant();
  }

  private clearServantCommandTarget(): void {
    this._selectedServantCommandId = null;
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

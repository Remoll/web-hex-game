import { GameMap, type MovementPath } from "@/game/board/gameMap/GameMap";
import {
  FactionDisposition,
  getFactionDisposition,
} from "@/game/faction/Faction";
import {
  EventTimeline,
  TimelineAction,
  type EventTimelineReader,
  type TimelinePresentation,
} from "@/game/eventTimeline/EventTimeline";
import { Unit, UnitTacticalRole } from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";
import {
  FieldVisibility,
  MageVisibility,
  type FieldVisibilityReader,
} from "@/game/visibility/MageVisibility";

export enum GameActionType {
  Selected = "selected",
  Deselected = "deselected",
  Moved = "moved",
  Attacked = "attacked",
  Waited = "waited",
  Ignored = "ignored",
}

export enum GameActionPreviewType {
  Selection = "selection",
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
  OutOfRange = "out-of-range",
  RoundExhausted = "round-exhausted",
}

export type GameAction =
  | { type: GameActionType.Selected; unitId: string }
  | { type: GameActionType.Deselected; unitId: string }
  | { type: GameActionType.Moved; unitId: string; from: HexCoord; to: HexCoord }
  | {
    type: GameActionType.Attacked;
    attackerId: string;
    targetId: string;
    damage: number;
    targetCurrentHp: number;
    targetDefeated: boolean;
  }
  | { type: GameActionType.Waited; unitId: string }
  | {
    type: GameActionType.Ignored;
    reason: GameActionRejectionReason;
  };

export type GameActionPreview =
  | { type: GameActionPreviewType.Selection; unitId: string }
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

/** Owns mutable game state without depending on rendering or browser APIs. */
export class GameSession {
  private readonly unitsById = new Map<string, Unit>();
  private readonly livingUnitIdsByHex = new Map<string, string>();
  private readonly mageId: string;
  private readonly mageVisibility: MageVisibility;
  private readonly timeline: EventTimeline;
  private _selectedUnitId: string | null = null;

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
    this.timeline.advancePassiveUnitsToMageDecision(this.mageId);
    this.recalculateMageVisibility();
  }

  get selectedUnitId(): string | null {
    return this._selectedUnitId;
  }

  /** Includes defeated units so presentation can render their visual remains. */
  get units(): readonly Unit[] {
    return [...this.unitsById.values()];
  }

  getUnit(id: string): Unit | undefined {
    return this.unitsById.get(id);
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
      return clickedUnit && this.isMage(clickedUnit)
        ? { type: GameActionPreviewType.Selection, unitId: clickedUnit.id }
        : {
          type: GameActionPreviewType.OutOfRange,
          reason: clickedUnit
            ? GameActionRejectionReason.NotPlayerControlled
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
      return { type: GameActionType.Deselected, unitId: selectedUnit.id };
    }

    const preview = this.previewHex(coord);
    switch (preview.type) {
      case GameActionPreviewType.Selection:
        this._selectedUnitId = preview.unitId;
        return { type: GameActionType.Selected, unitId: preview.unitId };
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

  /**
   * Retained for non-Mage Player-faction units until their own timeline work is
   * introduced. Mage actions are gated exclusively by EventTimeline readiness.
   */
  resetRoundBudgets(): void {
    for (const unit of this.unitsById.values()) {
      if (!this.isMage(unit)) {
        unit.resetRoundBudget();
      }
    }
  }

  /**
   * Ends the Mage's current activation without changing board state. Passive
   * units advance synchronously to their next deterministic Mage decision.
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
    this.timeline.advancePassiveUnitsToMageDecision(this.mageId);
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

    if (this.isMage(unit)) {
      if (!this.timeline.isReady(unit.id)) {
        return {
          type: GameActionType.Ignored,
          reason: GameActionRejectionReason.NotReady,
        };
      }
      this.timeline.consumeReadyAction(unit.id, TimelineAction.Move);
    } else {
      unit.spendMovement(preview.path.cost);
    }

    const from = unit.position;
    this.unregisterLivingUnit(unit);
    unit.moveTo(preview.destination);
    this.registerLivingUnit(unit);
    if (unit.id === this.mageId) {
      this.recalculateMageVisibility();
      this.timeline.advancePassiveUnitsToMageDecision(this.mageId);
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

    if (this.isMage(attacker)) {
      if (!this.timeline.isReady(attacker.id)) {
        return {
          type: GameActionType.Ignored,
          reason: GameActionRejectionReason.NotReady,
        };
      }
      this.timeline.consumeReadyAction(attacker.id, TimelineAction.Attack);
    }

    target.receiveDamage(attacker.attackPower);
    if (!this.isMage(attacker)) {
      attacker.exhaustRoundBudget();
    }
    if (!target.isAlive) {
      this.unregisterLivingUnit(target);
      this.timeline.invalidateUnit(target.id);
      if (target.id === this.mageId) {
        this.recalculateMageVisibility();
      }
    }
    if (this.isMage(attacker)) {
      this.timeline.advancePassiveUnitsToMageDecision(this.mageId);
    }

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
      return undefined;
    }

    return selectedUnit;
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
    return this.isMage(unit)
      ? this.timeline.isReady(unit.id)
      : unit.remainingMovement > 0;
  }

  private hasActionAvailability(unit: Unit): boolean {
    return this.isMage(unit)
      ? this.timeline.isReady(unit.id)
      : unit.remainingActions > 0;
  }

  private getMovementRangeForCurrentAction(unit: Unit): number {
    return this.isMage(unit) ? unit.movementRange : unit.remainingMovement;
  }

  private getAvailabilityRejectionReason(
    unit: Unit,
  ): Exclude<GameActionRejectionReason, GameActionRejectionReason.NoSelectedUnit> {
    return this.isMage(unit)
      ? GameActionRejectionReason.NotReady
      : GameActionRejectionReason.RoundExhausted;
  }

  private isMage(unit: Unit): boolean {
    return unit.id === this.mageId;
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

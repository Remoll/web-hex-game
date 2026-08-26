import { GameMap, type MovementPath } from "@/game/board/gameMap/GameMap";
import {
  Faction,
  FactionDisposition,
  getFactionDisposition,
} from "@/game/faction/Faction";
import { Unit } from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";

export type GameAction =
  | { type: "selected"; unitId: string }
  | { type: "deselected"; unitId: string }
  | { type: "moved"; unitId: string; from: HexCoord; to: HexCoord }
  | {
    type: "attacked";
    attackerId: string;
    targetId: string;
    damage: number;
    targetCurrentHp: number;
    targetDefeated: boolean;
  }
  | {
    type: "ignored";
    reason:
      | "missing-field"
      | "no-selected-unit"
      | "not-player-controlled"
      | "not-hostile"
      | "out-of-range"
      | "round-exhausted";
  };

export type GameActionPreview =
  | { type: "selection"; unitId: string }
  | {
    type: "valid-move";
    unitId: string;
    destination: HexCoord;
    path: MovementPath;
  }
  | { type: "valid-attack"; attackerId: string; targetId: string }
  | {
    type: "out-of-range";
    reason:
      | "missing-field"
      | "not-player-controlled"
      | "not-hostile"
      | "out-of-range"
      | "round-exhausted";
  };

export interface ReachableHex {
  readonly coord: HexCoord;
  readonly cost: number;
}

/** Owns mutable game state without depending on rendering or browser APIs. */
export class GameSession {
  private readonly unitsById = new Map<string, Unit>();
  private readonly livingUnitIdsByHex = new Map<string, string>();
  private _selectedUnitId: string | null = null;

  constructor(
    public readonly gameMap: GameMap,
    units: Iterable<Unit>,
  ) {
    for (const unit of units) {
      if (this.unitsById.has(unit.id)) {
        throw new Error(`A unit with id ${unit.id} already exists`);
      }

      this.unitsById.set(unit.id, unit);
      if (unit.isAlive) {
        this.registerLivingUnit(unit);
      }
    }
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

  /** Returns only a living occupant; corpses never block or receive input. */
  getUnitAt(coord: HexCoord): Unit | undefined {
    const unitId = this.livingUnitIdsByHex.get(getCoordKey(coord));
    return unitId ? this.unitsById.get(unitId) : undefined;
  }

  /** Provides movement data for future highlighting without leaking map internals. */
  getReachableHexes(): readonly ReachableHex[] {
    const selectedUnit = this.getSelectedPlayerUnit();
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
      return { type: "out-of-range", reason: "missing-field" };
    }

    const selectedUnit = this.getSelectedPlayerUnit();
    const clickedUnit = this.getUnitAt(coord);

    if (!selectedUnit) {
      return clickedUnit?.faction === Faction.Player
        ? { type: "selection", unitId: clickedUnit.id }
        : {
          type: "out-of-range",
          reason: clickedUnit ? "not-player-controlled" : "out-of-range",
        };
    }

    if (isSameHex(selectedUnit.position, coord)) {
      return { type: "selection", unitId: selectedUnit.id };
    }

    // Switching between player-controlled units remains available even when
    // the currently selected unit has exhausted its provisional round budget.
    if (clickedUnit?.faction === Faction.Player) {
      return { type: "selection", unitId: clickedUnit.id };
    }

    if (clickedUnit) {
      if (!this.hasActionAvailability(selectedUnit)) {
        return { type: "out-of-range", reason: "round-exhausted" };
      }

      if (getFactionDisposition(selectedUnit.faction, clickedUnit.faction)
        !== FactionDisposition.Enemy) {
        return { type: "out-of-range", reason: "not-hostile" };
      }

      return this.gameMap.getHexDistance(selectedUnit.position, coord) === 1
        ? {
          type: "valid-attack",
          attackerId: selectedUnit.id,
          targetId: clickedUnit.id,
        }
        : { type: "out-of-range", reason: "out-of-range" };
    }

    if (!this.hasMovementAvailability(selectedUnit)) {
      return { type: "out-of-range", reason: "round-exhausted" };
    }

    const path = this.getReachablePaths(selectedUnit).get(getCoordKey(coord));
    return path
      ? {
        type: "valid-move",
        unitId: selectedUnit.id,
        destination: { ...coord },
        path,
      }
      : { type: "out-of-range", reason: "out-of-range" };
  }

  clickHex(coord: HexCoord): GameAction {
    if (!this.gameMap.getField(coord.q, coord.r)) {
      return { type: "ignored", reason: "missing-field" };
    }

    const selectedUnit = this.getSelectedPlayerUnit();
    if (selectedUnit && isSameHex(selectedUnit.position, coord)) {
      this._selectedUnitId = null;
      return { type: "deselected", unitId: selectedUnit.id };
    }

    const preview = this.previewHex(coord);
    switch (preview.type) {
      case "selection":
        this._selectedUnitId = preview.unitId;
        return { type: "selected", unitId: preview.unitId };
      case "valid-move":
        return this.moveSelectedUnit(preview);
      case "valid-attack":
        return this.attack(preview);
      case "out-of-range":
        if (!selectedUnit && !this.getUnitAt(coord)) {
          return { type: "ignored", reason: "no-selected-unit" };
        }

        return { type: "ignored", reason: preview.reason };
    }
  }

  /** Future turn orchestration restores the temporary per-round allowance. */
  resetRoundBudgets(): void {
    for (const unit of this.unitsById.values()) {
      unit.resetRoundBudget();
    }
  }

  private moveSelectedUnit(preview: Extract<GameActionPreview, { type: "valid-move" }>): GameAction {
    const unit = this.unitsById.get(preview.unitId);
    if (!unit || !unit.isAlive) {
      return { type: "ignored", reason: "no-selected-unit" };
    }

    const from = unit.position;
    unit.spendMovement(preview.path.cost);
    this.unregisterLivingUnit(unit);
    unit.moveTo(preview.destination);
    this.registerLivingUnit(unit);

    return {
      type: "moved",
      unitId: unit.id,
      from,
      to: unit.position,
    };
  }

  private attack(preview: Extract<GameActionPreview, { type: "valid-attack" }>): GameAction {
    const attacker = this.unitsById.get(preview.attackerId);
    const target = this.unitsById.get(preview.targetId);
    if (!attacker || !target || !attacker.isAlive || !target.isAlive) {
      return { type: "ignored", reason: "out-of-range" };
    }

    target.receiveDamage(attacker.attackPower);
    attacker.exhaustRoundBudget();
    if (!target.isAlive) {
      this.unregisterLivingUnit(target);
    }

    return {
      type: "attacked",
      attackerId: attacker.id,
      targetId: target.id,
      damage: attacker.attackPower,
      targetCurrentHp: target.currentHp,
      targetDefeated: !target.isAlive,
    };
  }

  private getSelectedPlayerUnit(): Unit | undefined {
    if (!this._selectedUnitId) {
      return undefined;
    }

    const selectedUnit = this.unitsById.get(this._selectedUnitId);
    if (!selectedUnit || !selectedUnit.isAlive || selectedUnit.faction !== Faction.Player) {
      this._selectedUnitId = null;
      return undefined;
    }

    return selectedUnit;
  }

  private getReachablePaths(unit: Unit): ReadonlyMap<string, MovementPath> {
    return this.gameMap.getReachablePaths(
      unit.position,
      unit.movementType,
      unit.remainingMovement,
      (coord) => this.getUnitAt(coord) !== undefined,
    );
  }

  private hasMovementAvailability(unit: Unit): boolean {
    return unit.remainingMovement > 0;
  }

  private hasActionAvailability(unit: Unit): boolean {
    return unit.remainingActions > 0;
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
}

function getCoordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function isSameHex(first: HexCoord, second: HexCoord): boolean {
  return first.q === second.q && first.r === second.r;
}

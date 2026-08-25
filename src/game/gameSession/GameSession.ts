import { GameMap } from "@/game/board/gameMap/GameMap";
import { Unit } from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";

export type GameAction =
  | { type: "selected"; unitId: string }
  | { type: "deselected"; unitId: string }
  | { type: "moved"; unitId: string; from: HexCoord; to: HexCoord }
  | { type: "ignored"; reason: "missing-field" | "no-selected-unit" };

/** Owns mutable game state without depending on rendering or browser APIs. */
export class GameSession {
  private readonly unitsById = new Map<string, Unit>();
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
    }
  }

  get selectedUnitId(): string | null {
    return this._selectedUnitId;
  }

  get units(): readonly Unit[] {
    return [...this.unitsById.values()];
  }

  getUnit(id: string): Unit | undefined {
    return this.unitsById.get(id);
  }

  clickHex(coord: HexCoord): GameAction {
    const clickedUnit = this.getUnitAt(coord);

    if (clickedUnit) {
      if (this._selectedUnitId === clickedUnit.id) {
        this._selectedUnitId = null;
        return { type: "deselected", unitId: clickedUnit.id };
      }

      this._selectedUnitId = clickedUnit.id;
      return { type: "selected", unitId: clickedUnit.id };
    }

    if (!this.gameMap.getField(coord.q, coord.r)) {
      return { type: "ignored", reason: "missing-field" };
    }

    if (!this._selectedUnitId) {
      return { type: "ignored", reason: "no-selected-unit" };
    }

    const selectedUnit = this.unitsById.get(this._selectedUnitId);
    if (!selectedUnit) {
      this._selectedUnitId = null;
      return { type: "ignored", reason: "no-selected-unit" };
    }

    const from = selectedUnit.position;
    selectedUnit.moveTo(coord);

    return {
      type: "moved",
      unitId: selectedUnit.id,
      from,
      to: selectedUnit.position,
    };
  }

  private getUnitAt(coord: HexCoord): Unit | undefined {
    return this.units.find(
      (unit) => unit.position.q === coord.q && unit.position.r === coord.r,
    );
  }
}

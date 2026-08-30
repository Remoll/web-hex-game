import { GameMap } from "@/game/board/gameMap/GameMap";
import { isSameHexCoord } from "@/game/board/hexCoord/HexCoord";
import { MovementType, type HexCoord } from "@/game/types";

const strategicStepDistance = 1;

/** Navigation-only state for a party marker; it has no AP, timeline, or fog. */
export class StrategicSession {
  private _partyPosition: HexCoord;

  constructor(
    public readonly gameMap: GameMap,
    initialPartyPosition: HexCoord,
  ) {
    if (!gameMap.getField(initialPartyPosition.q, initialPartyPosition.r)) {
      throw new Error("The strategic party starts outside the strategic map");
    }
    this._partyPosition = { ...initialPartyPosition };
  }

  get partyPosition(): HexCoord {
    return { ...this._partyPosition };
  }

  getReachableCoordinates(): readonly HexCoord[] {
    return this.gameMap.getNeighbours(this._partyPosition).filter((coordinate) => (
      this.gameMap.getTraversalCost(
        this._partyPosition,
        coordinate,
        MovementType.Ground,
      ) !== undefined
    ));
  }

  canMoveTo(destination: HexCoord): boolean {
    return this.gameMap.getHexDistance(this._partyPosition, destination)
      === strategicStepDistance
      && this.gameMap.getTraversalCost(
        this._partyPosition,
        destination,
        MovementType.Ground,
      ) !== undefined;
  }

  moveTo(destination: HexCoord): boolean {
    if (!this.canMoveTo(destination)) {
      return false;
    }
    this._partyPosition = { ...destination };
    return true;
  }

  moveToRouteEndpoint(destination: HexCoord): void {
    if (!this.gameMap.getField(destination.q, destination.r)) {
      throw new Error("The strategic route endpoint is outside the strategic map");
    }
    this._partyPosition = { ...destination };
  }

  isPartyAt(coordinate: HexCoord): boolean {
    return isSameHexCoord(this._partyPosition, coordinate);
  }
}

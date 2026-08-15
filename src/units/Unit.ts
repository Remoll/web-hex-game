import type { HexCoord } from "../types";
import { Formulas } from "../formulas/Formulas";
import type { CustomInstancedMesh } from "../CustomInstancedMesh/CustomInstancedMesh";
import { GameContext } from "../GameContext/GameContext";
import { GameConstants } from "../GameConstants/GameContsants";

export abstract class Unit {
  public id: string;
  public position: HexCoord;
  private readonly instanceMesh: CustomInstancedMesh;

  constructor(
    id: string,
    initialPosition: HexCoord,
    instanceMesh: CustomInstancedMesh,
  ) {
    this.id = id;
    this.position = initialPosition;
    this.instanceMesh = instanceMesh;
  }

  // Przesunięcie jednostki na nowy heks i aktualizacja macierzy w InstancedMesh
  public moveTo(newHex: HexCoord): void {
    this.position = newHex;
    const field = GameContext.gameMap.getField(
      this.position.q,
      this.position.r,
    );
    const level = field ? field.getGroundLevel() : 0;
    const targetZ =
      (level + 1) * GameConstants.HEX_DEPTH + GameConstants.UNITS_HEIGHT / 2;

    const pos2D = Formulas.hexCoordToPlaneCoord(
      this.position,
      GameConstants.SIZE,
    );
    this.instanceMesh.updateState(pos2D.x, pos2D.y, targetZ, 0, 1);
  }
}

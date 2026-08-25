import { Unit, type UnitTexture } from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";

export class Player extends Unit {
  constructor(id: string, initialPosition: HexCoord, texture: UnitTexture) {
    super(id, initialPosition, texture);
  }
}

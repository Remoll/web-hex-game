import { Unit } from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";

export class Player extends Unit {
  constructor(id: string, initialPosition: HexCoord) {
    super(id, initialPosition);
  }
}

import { Unit } from "./Unit";
import type { HexCoord } from "../types";

export class Player extends Unit {
  public isSelected: boolean = false;

  constructor(id: string, initialPosition: HexCoord, instanceIndex: number) {
    super(id, initialPosition, instanceIndex);
  }
}
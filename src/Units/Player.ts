import { Unit } from "@/Units/Unit";
import type { HexCoord } from "@/types";
import type { CustomInstancedMesh } from "@/CustomInstancedMesh/CustomInstancedMesh";

export class Player extends Unit {
  public isSelected: boolean = false;

  constructor(
    id: string,
    initialPosition: HexCoord,
    instancedMesh: CustomInstancedMesh,
  ) {
    super(id, initialPosition, instancedMesh);
  }
}

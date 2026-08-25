import type {
  AllowedMovements,
  FieldAttrs,
  TerrainType,
} from "@/game/types";

export class Field {
  private terrainType: TerrainType;
  private allowedMovements: AllowedMovements;
  private groundLevel: number;
  private leavingCostMultiplier: number;

  constructor(fieldAttrs: FieldAttrs) {
    const {
      terrainType,
      allowedMovements,
      groundLevel = 0,
      leavingCostMultiplier = 1,
    } = fieldAttrs;

    this.terrainType = terrainType;
    this.allowedMovements = allowedMovements;
    this.groundLevel = groundLevel;
    this.leavingCostMultiplier = leavingCostMultiplier;
  }

  getTerrainType() {
    return this.terrainType;
  }

  getAllowedMovements() {
    return this.allowedMovements;
  }

  getGroundLevel() {
    return this.groundLevel;
  }

  getLeavingCostMultiplier() {
    return this.leavingCostMultiplier;
  }
}

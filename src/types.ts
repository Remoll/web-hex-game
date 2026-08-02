export interface HexCoord {
  q: Q;
  r: R;
}

export interface PlaneCoord {
  x: number;
  y: number;
}

export enum TerrainType {
  Grass,
  Water,
}

export enum MovementType {
  Ground,
  Flying,
}

export type AllowedMovements = Record<MovementType, boolean>;

export interface FieldAttrs {
  terrainType: TerrainType;
  allowedMovements: AllowedMovements;
  groundLevel: number;
  leavingCostMultiplier: number;
}

export type Q = number;

export type R = number;

export type MapArray = { q: Q; r: R; fieldAttrs: FieldAttrs }[];

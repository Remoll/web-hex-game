import type { Field } from "@/Field/Field";

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

interface MapArrayItem {
  q: Q;
  r: R;
  fieldAttrs: FieldAttrs;
}

export type MapArray = MapArrayItem[];

export type FieldsMap = Map<Q, Map<R, Field>>;

export enum CameraMode {
  FOLLOW,
  FREE,
}

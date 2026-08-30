import type { Field } from "@/game/board/field/Field";

export { Faction, FactionDisposition } from "@/game/faction/Faction";

export interface HexCoord {
  q: Q;
  r: R;
}

export interface PlaneCoord {
  x: number;
  y: number;
}

export enum TerrainType {
  Grass = "grass",
  Cobblestone = "cobblestone",
  ShallowWater = "shallow-water",
  Water = "water",
}

export enum MovementType {
  Ground = "ground",
  Flying = "flying",
}

export type AllowedMovements = Readonly<Record<MovementType, boolean>>;

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

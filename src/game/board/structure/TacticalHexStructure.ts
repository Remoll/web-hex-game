import type { HexCoord } from "@/game/types";

/** Stable serialized identifiers for one full-hex tactical structure. */
export enum TacticalHexStructureType {
  WallBlock = "wall-block",
  DoorBlock = "door-block",
  WindowBlock = "window-block",
  Tree = "tree",
}

/** Wall side materials are authored independently of later render assets. */
export enum WallBlockSideMaterial {
  Stone = "stone",
  Timber = "timber",
}

/** The three valid full-hex orientation axes for doors and windows. */
export enum TacticalHexAxis {
  Q = "q",
  R = "r",
  S = "s",
}

/** Initial data only; Door state changes belong to a later gameplay story. */
export enum DoorBlockInitialState {
  Open = "open",
  Closed = "closed",
}

/** A WallBlock always has this renderer-facing top-cap contract. */
export enum WallBlockTopCapPresentation {
  Dark = "dark",
}

export const standardWallBlockTopCapPresentation = WallBlockTopCapPresentation.Dark;

export interface WallBlockStructureDefinition {
  readonly type: TacticalHexStructureType.WallBlock;
  readonly sideMaterial: WallBlockSideMaterial;
}

export interface DoorBlockStructureDefinition {
  readonly type: TacticalHexStructureType.DoorBlock;
  readonly axis: TacticalHexAxis;
  readonly initialState: DoorBlockInitialState;
}

export interface WindowBlockStructureDefinition {
  readonly type: TacticalHexStructureType.WindowBlock;
  readonly axis: TacticalHexAxis;
}

export interface TreeStructureDefinition {
  readonly type: TacticalHexStructureType.Tree;
}

/** Strict, serializable input for one authored full-hex structure. */
export type TacticalHexStructureDefinition =
  | WallBlockStructureDefinition
  | DoorBlockStructureDefinition
  | WindowBlockStructureDefinition
  | TreeStructureDefinition;

/** One data-defined full-hex structure placement in a level's `structures` array. */
export interface TacticalHexStructurePlacementDefinition extends HexCoord {
  readonly id: string;
  readonly structure: TacticalHexStructureDefinition;
}

export interface WallBlockStructureProjection extends WallBlockStructureDefinition {
  readonly topCapPresentation: WallBlockTopCapPresentation;
}

export type TacticalHexStructureProjection =
  | WallBlockStructureProjection
  | DoorBlockStructureDefinition
  | WindowBlockStructureDefinition
  | TreeStructureDefinition;

/** Immutable indexed placement data for future interaction and presentation. */
export interface TacticalHexStructurePlacementProjection {
  readonly id: string;
  readonly coordinate: HexCoord;
  readonly structure: TacticalHexStructureProjection;
}

const structureTypePropertyName = "type";
const wallBlockSideMaterialPropertyName = "sideMaterial";
const orientedStructureAxisPropertyName = "axis";
const doorBlockInitialStatePropertyName = "initialState";
const wallBlockPropertyNames = [
  structureTypePropertyName,
  wallBlockSideMaterialPropertyName,
] as const;
const doorBlockPropertyNames = [
  structureTypePropertyName,
  orientedStructureAxisPropertyName,
  doorBlockInitialStatePropertyName,
] as const;
const windowBlockPropertyNames = [
  structureTypePropertyName,
  orientedStructureAxisPropertyName,
] as const;
const treePropertyNames = [structureTypePropertyName] as const;

/**
 * Validates and clones one JSON-safe structure declaration. The returned
 * discriminated definition intentionally contains only data applicable to its
 * declared type.
 */
export function parseTacticalHexStructureDefinition(
  value: unknown,
  context: string,
): TacticalHexStructureDefinition {
  const record = requireRecord(value, context);
  const type = parseStructureType(
    requireProperty(record, structureTypePropertyName, context),
    context,
  );

  switch (type) {
    case TacticalHexStructureType.WallBlock:
      assertExactPropertyNames(record, wallBlockPropertyNames, context);
      return Object.freeze({
        type,
        sideMaterial: parseWallBlockSideMaterial(
          requireProperty(record, wallBlockSideMaterialPropertyName, context),
          context,
        ),
      });
    case TacticalHexStructureType.DoorBlock:
      assertExactPropertyNames(record, doorBlockPropertyNames, context);
      return Object.freeze({
        type,
        axis: parseTacticalHexAxis(
          requireProperty(record, orientedStructureAxisPropertyName, context),
          context,
        ),
        initialState: parseDoorBlockInitialState(
          requireProperty(record, doorBlockInitialStatePropertyName, context),
          context,
        ),
      });
    case TacticalHexStructureType.WindowBlock:
      assertExactPropertyNames(record, windowBlockPropertyNames, context);
      return Object.freeze({
        type,
        axis: parseTacticalHexAxis(
          requireProperty(record, orientedStructureAxisPropertyName, context),
          context,
        ),
      });
    case TacticalHexStructureType.Tree:
      assertExactPropertyNames(record, treePropertyNames, context);
      return Object.freeze({ type });
  }
}

/**
 * Produces the one immutable domain projection stored by GameMap. Future
 * gameplay and rendering can consume it without reparsing serialized data.
 */
export function createTacticalHexStructureProjection(
  definition: TacticalHexStructureDefinition,
): TacticalHexStructureProjection {
  const parsedDefinition = parseTacticalHexStructureDefinition(
    definition,
    "Tactical structure definition",
  );

  if (parsedDefinition.type === TacticalHexStructureType.WallBlock) {
    return Object.freeze({
      ...parsedDefinition,
      topCapPresentation: standardWallBlockTopCapPresentation,
    });
  }

  return parsedDefinition;
}

/** Validates and freezes one map-owned structure placement and its identity. */
export function createTacticalHexStructurePlacementProjection(
  definition: TacticalHexStructurePlacementDefinition,
): TacticalHexStructurePlacementProjection {
  if (typeof definition.id !== "string" || definition.id.length === 0) {
    throw new Error("Tactical structure placement id must be a non-empty string");
  }
  if (!Number.isInteger(definition.q) || !Number.isInteger(definition.r)) {
    throw new Error(`Tactical structure ${definition.id} must use integer hex coordinates`);
  }

  return Object.freeze({
    id: definition.id,
    coordinate: Object.freeze({ q: definition.q, r: definition.r }),
    structure: createTacticalHexStructureProjection(definition.structure),
  });
}

/** WallBlocks and Trees are the current full-hex solid cover types. */
export function isGroundMovementBlockingTacticalHexStructure(
  structure: TacticalHexStructureProjection | undefined,
): boolean {
  return structure?.type === TacticalHexStructureType.WallBlock
    || structure?.type === TacticalHexStructureType.Tree;
}

/** Door and Window behavior is intentionally deferred and therefore transparent. */
export function isSightBlockingTacticalHexStructure(
  structure: TacticalHexStructureProjection | undefined,
): boolean {
  return isGroundMovementBlockingTacticalHexStructure(structure);
}

function requireRecord(value: unknown, context: string): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireProperty(
  record: Readonly<Record<string, unknown>>,
  propertyName: string,
  context: string,
): unknown {
  if (!Object.hasOwn(record, propertyName)) {
    throw new Error(`${context} is missing required property ${propertyName}`);
  }
  return record[propertyName];
}

function assertExactPropertyNames(
  record: Readonly<Record<string, unknown>>,
  allowedPropertyNames: readonly string[],
  context: string,
): void {
  for (const propertyName of Object.keys(record)) {
    if (!allowedPropertyNames.includes(propertyName)) {
      throw new Error(`${context} does not support property ${propertyName}`);
    }
  }
}

function parseStructureType(value: unknown, context: string): TacticalHexStructureType {
  switch (value) {
    case TacticalHexStructureType.WallBlock:
    case TacticalHexStructureType.DoorBlock:
    case TacticalHexStructureType.WindowBlock:
    case TacticalHexStructureType.Tree:
      return value;
    default:
      throw new Error(`${context} has unsupported structure type ${String(value)}`);
  }
}

function parseWallBlockSideMaterial(value: unknown, context: string): WallBlockSideMaterial {
  switch (value) {
    case WallBlockSideMaterial.Stone:
    case WallBlockSideMaterial.Timber:
      return value;
    default:
      throw new Error(`${context} has unsupported WallBlock side material ${String(value)}`);
  }
}

function parseTacticalHexAxis(value: unknown, context: string): TacticalHexAxis {
  switch (value) {
    case TacticalHexAxis.Q:
    case TacticalHexAxis.R:
    case TacticalHexAxis.S:
      return value;
    default:
      throw new Error(`${context} has unsupported hex axis ${String(value)}`);
  }
}

function parseDoorBlockInitialState(value: unknown, context: string): DoorBlockInitialState {
  switch (value) {
    case DoorBlockInitialState.Open:
    case DoorBlockInitialState.Closed:
      return value;
    default:
      throw new Error(`${context} has unsupported DoorBlock initial state ${String(value)}`);
  }
}

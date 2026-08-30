import { getHexCoordKey } from "@/game/board/hexCoord/HexCoord";
import {
  parseTacticalHexStructureDefinition,
  type TacticalHexStructurePlacementDefinition,
} from "@/game/board/structure/TacticalHexStructure";
import { Faction } from "@/game/faction/Faction";
import type { LevelDefinition, UnitDefinition } from "@/game/levels/LevelDefinition";
import {
  MovementType,
  TerrainType,
  type AllowedMovements,
  type FieldAttrs,
  type HexCoord,
  type MapArray,
} from "@/game/types";
import {
  TacticalAttribute,
  type TacticalAttributeInput,
} from "@/game/unit/tacticalAttributes/TacticalAttributes";
import { UnitTacticalRole, UnitTexture } from "@/game/unit/Unit";

const mapPropertyName = "map";
const structuresPropertyName = "structures";
const playerPropertyName = "player";
const unitsPropertyName = "units";
const structurePlacementIdPropertyName = "id";
const levelPropertyNames = [
  mapPropertyName,
  structuresPropertyName,
  playerPropertyName,
  unitsPropertyName,
] as const;
const requiredLevelPropertyNames = [
  mapPropertyName,
  playerPropertyName,
  unitsPropertyName,
] as const;

const coordinateQPropertyName = "q";
const coordinateRPropertyName = "r";
const fieldAttributesPropertyName = "fieldAttrs";
const mapFieldPropertyNames = [
  coordinateQPropertyName,
  coordinateRPropertyName,
  fieldAttributesPropertyName,
] as const;

const terrainTypePropertyName = "terrainType";
const allowedMovementsPropertyName = "allowedMovements";
const groundLevelPropertyName = "groundLevel";
const leavingCostMultiplierPropertyName = "leavingCostMultiplier";
const structurePropertyName = "structure";
const fieldAttributesPropertyNames = [
  terrainTypePropertyName,
  allowedMovementsPropertyName,
  groundLevelPropertyName,
  leavingCostMultiplierPropertyName,
] as const;

const structurePlacementPropertyNames = [
  structurePlacementIdPropertyName,
  coordinateQPropertyName,
  coordinateRPropertyName,
  structurePropertyName,
] as const;

const unitIdPropertyName = structurePlacementIdPropertyName;
const unitPositionPropertyName = "position";
const unitTexturePropertyName = "texture";
const unitFactionPropertyName = "faction";
const unitMovementTypePropertyName = "movementType";
const unitMovementRangePropertyName = "movementRange";
const unitCurrentHitPointsPropertyName = "currentHp";
const unitAttackPowerPropertyName = "attackPower";
const unitTacticalRolePropertyName = "tacticalRole";
const unitViewRangePropertyName = "viewRange";
const unitAttributesPropertyName = "attributes";
const unitPropertyNames = [
  unitIdPropertyName,
  unitPositionPropertyName,
  unitTexturePropertyName,
  unitFactionPropertyName,
  unitMovementTypePropertyName,
  unitMovementRangePropertyName,
  unitCurrentHitPointsPropertyName,
  unitAttackPowerPropertyName,
  unitTacticalRolePropertyName,
  unitViewRangePropertyName,
  unitAttributesPropertyName,
] as const;
const requiredUnitPropertyNames = [
  unitIdPropertyName,
  unitPositionPropertyName,
  unitTexturePropertyName,
] as const;
const coordinatePropertyNames = [coordinateQPropertyName, coordinateRPropertyName] as const;
const movementTypePropertyNames = [MovementType.Ground, MovementType.Flying] as const;
const tacticalAttributePropertyNames = [
  TacticalAttribute.Might,
  TacticalAttribute.Finesse,
  TacticalAttribute.Vitality,
  TacticalAttribute.Insight,
] as const;
const minimumLeavingCostMultiplier = 0;
const minimumViewRange = 1;
const minimumNonNegativeInteger = 0;

type MutableTacticalAttributeInput = {
  [attribute in TacticalAttribute]?: number;
};

/**
 * Parses one public level JSON value into level data with strict structure
 * declarations. It runs only at load time; GameMap later owns the immutable
 * indexed structure projections.
 */
export function parseLevelDefinition(value: unknown): LevelDefinition {
  const record = requireRecord(value, "Level definition");
  assertExpectedProperties(
    record,
    levelPropertyNames,
    requiredLevelPropertyNames,
    "Level definition",
  );

  const map = parseMap(
    requireProperty(record, mapPropertyName, "Level definition"),
  );
  const structures = Object.hasOwn(record, structuresPropertyName)
    ? parseStructurePlacements(record[structuresPropertyName], map)
    : undefined;
  const player = parseUnitDefinition(
    requireProperty(record, playerPropertyName, "Level definition"),
    "Level player",
  );
  const units = parseUnits(
    requireProperty(record, unitsPropertyName, "Level definition"),
  );

  return structures
    ? { map, structures, player, units }
    : { map, player, units };
}

function parseMap(value: unknown): MapArray {
  if (!Array.isArray(value)) {
    throw new Error("Level map must be an array");
  }

  const map: MapArray = [];
  const fieldCoordinateKeys = new Set<string>();
  for (const [index, mapFieldValue] of value.entries()) {
    const context = `Level map field ${index}`;
    const record = requireRecord(mapFieldValue, context);
    assertExpectedProperties(record, mapFieldPropertyNames, mapFieldPropertyNames, context);
    const coordinate = parseHexCoordRecord(record, context);
    const coordinateKey = getHexCoordKey(coordinate);
    if (fieldCoordinateKeys.has(coordinateKey)) {
      throw new Error(`Level map contains duplicate field coordinates at ${coordinateKey}`);
    }
    fieldCoordinateKeys.add(coordinateKey);
    map.push({
      ...coordinate,
      fieldAttrs: parseFieldAttrs(
        requireProperty(record, fieldAttributesPropertyName, context),
        context,
      ),
    });
  }

  return map;
}

function parseFieldAttrs(value: unknown, fieldContext: string): FieldAttrs {
  const context = `${fieldContext} attributes`;
  const record = requireRecord(value, context);
  assertExpectedProperties(record, fieldAttributesPropertyNames, fieldAttributesPropertyNames, context);

  return {
    terrainType: parseTerrainType(
      requireProperty(record, terrainTypePropertyName, context),
      context,
    ),
    allowedMovements: parseAllowedMovements(
      requireProperty(record, allowedMovementsPropertyName, context),
      context,
    ),
    groundLevel: parseNonNegativeInteger(
      requireProperty(record, groundLevelPropertyName, context),
      context,
    ),
    leavingCostMultiplier: parseMinimumNumber(
      requireProperty(record, leavingCostMultiplierPropertyName, context),
      minimumLeavingCostMultiplier,
      context,
    ),
  };
}

function parseStructurePlacements(
  value: unknown,
  map: MapArray,
): readonly TacticalHexStructurePlacementDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error("Level structures must be an array");
  }

  const mapCoordinateKeys = new Set(map.map(getHexCoordKey));
  const structureCoordinateKeys = new Set<string>();
  const structureIds = new Set<string>();
  const placements: TacticalHexStructurePlacementDefinition[] = [];
  for (const [index, placementValue] of value.entries()) {
    const context = `Level structure ${index}`;
    const record = requireRecord(placementValue, context);
    assertExpectedProperties(
      record,
      structurePlacementPropertyNames,
      structurePlacementPropertyNames,
      context,
    );
    const coordinate = parseHexCoordRecord(record, context);
    const id = parseNonEmptyString(
      requireProperty(record, structurePlacementIdPropertyName, context),
      `${context} id`,
    );
    if (structureIds.has(id)) {
      throw new Error(`Level structures contain duplicate id ${id}`);
    }
    const coordinateKey = getHexCoordKey(coordinate);
    if (!mapCoordinateKeys.has(coordinateKey)) {
      throw new Error(`Level structure ${index} references missing map field ${coordinateKey}`);
    }
    if (structureCoordinateKeys.has(coordinateKey)) {
      throw new Error(`Level structures contain duplicate placement at ${coordinateKey}`);
    }
    structureCoordinateKeys.add(coordinateKey);
    structureIds.add(id);
    placements.push(Object.freeze({
      id,
      ...coordinate,
      structure: parseTacticalHexStructureDefinition(
        requireProperty(record, structurePropertyName, context),
        context,
      ),
    }));
  }

  return Object.freeze(placements);
}

function parseAllowedMovements(value: unknown, context: string): AllowedMovements {
  const record = requireRecord(value, `${context} allowed movements`);
  assertExpectedProperties(
    record,
    movementTypePropertyNames,
    movementTypePropertyNames,
    `${context} allowed movements`,
  );
  return {
    [MovementType.Ground]: parseBoolean(
      requireProperty(record, MovementType.Ground, `${context} allowed movements`),
      `${context} allowed movements ${MovementType.Ground}`,
    ),
    [MovementType.Flying]: parseBoolean(
      requireProperty(record, MovementType.Flying, `${context} allowed movements`),
      `${context} allowed movements ${MovementType.Flying}`,
    ),
  };
}

function parseUnits(value: unknown): readonly UnitDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error("Level units must be an array");
  }
  return value.map((unitValue, index) => parseUnitDefinition(unitValue, `Level unit ${index}`));
}

function parseUnitDefinition(value: unknown, context: string): UnitDefinition {
  const record = requireRecord(value, context);
  assertExpectedProperties(record, unitPropertyNames, requiredUnitPropertyNames, context);
  const unit: UnitDefinition = {
    id: parseNonEmptyString(requireProperty(record, unitIdPropertyName, context), `${context} id`),
    position: parseHexCoord(
      requireProperty(record, unitPositionPropertyName, context),
      `${context} position`,
    ),
    texture: parseUnitTexture(
      requireProperty(record, unitTexturePropertyName, context),
      `${context} texture`,
    ),
  };

  const faction = parseOptionalFaction(record, context);
  const movementType = parseOptionalMovementType(record, context);
  const movementRange = parseOptionalNonNegativeInteger(
    record,
    unitMovementRangePropertyName,
    context,
  );
  const currentHp = parseOptionalNonNegativeInteger(
    record,
    unitCurrentHitPointsPropertyName,
    context,
  );
  const attackPower = parseOptionalNonNegativeInteger(record, unitAttackPowerPropertyName, context);
  const tacticalRole = parseOptionalUnitTacticalRole(record, context);
  const viewRange = parseOptionalMinimumNumber(
    record,
    unitViewRangePropertyName,
    minimumViewRange,
    context,
  );
  const attributes = parseOptionalAttributes(record, context);

  return {
    ...unit,
    ...(faction === undefined ? {} : { faction }),
    ...(movementType === undefined ? {} : { movementType }),
    ...(movementRange === undefined ? {} : { movementRange }),
    ...(currentHp === undefined ? {} : { currentHp }),
    ...(attackPower === undefined ? {} : { attackPower }),
    ...(tacticalRole === undefined ? {} : { tacticalRole }),
    ...(viewRange === undefined ? {} : { viewRange }),
    ...(attributes === undefined ? {} : { attributes }),
  };
}

function parseOptionalFaction(
  record: Readonly<Record<string, unknown>>,
  context: string,
): Faction | undefined {
  return Object.hasOwn(record, unitFactionPropertyName)
    ? parseFaction(record[unitFactionPropertyName], `${context} faction`)
    : undefined;
}

function parseOptionalMovementType(
  record: Readonly<Record<string, unknown>>,
  context: string,
): MovementType | undefined {
  return Object.hasOwn(record, unitMovementTypePropertyName)
    ? parseMovementType(record[unitMovementTypePropertyName], `${context} movement type`)
    : undefined;
}

function parseOptionalUnitTacticalRole(
  record: Readonly<Record<string, unknown>>,
  context: string,
): UnitTacticalRole | undefined {
  return Object.hasOwn(record, unitTacticalRolePropertyName)
    ? parseUnitTacticalRole(record[unitTacticalRolePropertyName], `${context} tactical role`)
    : undefined;
}

function parseOptionalNonNegativeInteger(
  record: Readonly<Record<string, unknown>>,
  propertyName: string,
  context: string,
): number | undefined {
  return Object.hasOwn(record, propertyName)
    ? parseNonNegativeInteger(record[propertyName], `${context} ${propertyName}`)
    : undefined;
}

function parseOptionalMinimumNumber(
  record: Readonly<Record<string, unknown>>,
  propertyName: string,
  minimum: number,
  context: string,
): number | undefined {
  return Object.hasOwn(record, propertyName)
    ? parseMinimumNumber(record[propertyName], minimum, `${context} ${propertyName}`)
    : undefined;
}

function parseOptionalAttributes(
  record: Readonly<Record<string, unknown>>,
  context: string,
): TacticalAttributeInput | undefined {
  if (!Object.hasOwn(record, unitAttributesPropertyName)) {
    return undefined;
  }

  const attributeContext = `${context} attributes`;
  const attributesRecord = requireRecord(record[unitAttributesPropertyName], attributeContext);
  assertExpectedProperties(
    attributesRecord,
    tacticalAttributePropertyNames,
    [],
    attributeContext,
  );
  const attributes: MutableTacticalAttributeInput = {};
  for (const attribute of tacticalAttributePropertyNames) {
    if (Object.hasOwn(attributesRecord, attribute)) {
      attributes[attribute] = parseNonNegativeInteger(
        attributesRecord[attribute],
        `${attributeContext} ${attribute}`,
      );
    }
  }
  return attributes;
}

function parseHexCoord(value: unknown, context: string): HexCoord {
  const record = requireRecord(value, context);
  assertExpectedProperties(record, coordinatePropertyNames, coordinatePropertyNames, context);
  return parseHexCoordRecord(record, context);
}

function parseHexCoordRecord(
  record: Readonly<Record<string, unknown>>,
  context: string,
): HexCoord {
  return {
    q: parseInteger(requireProperty(record, coordinateQPropertyName, context), `${context} q`),
    r: parseInteger(requireProperty(record, coordinateRPropertyName, context), `${context} r`),
  };
}

function parseTerrainType(value: unknown, context: string): TerrainType {
  switch (value) {
    case TerrainType.Grass:
    case TerrainType.Cobblestone:
    case TerrainType.ShallowWater:
    case TerrainType.Water:
      return value;
    default:
      throw new Error(`${context} has unsupported terrain type ${String(value)}`);
  }
}

function parseFaction(value: unknown, context: string): Faction {
  switch (value) {
    case Faction.Player:
    case Faction.Enemy:
    case Faction.Neutral:
      return value;
    default:
      throw new Error(`${context} has unsupported faction ${String(value)}`);
  }
}

function parseMovementType(value: unknown, context: string): MovementType {
  switch (value) {
    case MovementType.Ground:
    case MovementType.Flying:
      return value;
    default:
      throw new Error(`${context} has unsupported movement type ${String(value)}`);
  }
}

function parseUnitTexture(value: unknown, context: string): UnitTexture {
  switch (value) {
    case UnitTexture.PlayerIdle:
    case UnitTexture.AllyIdle:
    case UnitTexture.EnemyIdle:
      return value;
    default:
      throw new Error(`${context} has unsupported texture ${String(value)}`);
  }
}

function parseUnitTacticalRole(value: unknown, context: string): UnitTacticalRole {
  switch (value) {
    case UnitTacticalRole.None:
    case UnitTacticalRole.Mage:
      return value;
    default:
      throw new Error(`${context} has unsupported tactical role ${String(value)}`);
  }
}

function parseBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${context} must be a boolean`);
  }
  return value;
}

function parseNonEmptyString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} must be a non-empty string`);
  }
  return value;
}

function parseInteger(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${context} must be an integer`);
  }
  return value;
}

function parseNonNegativeInteger(value: unknown, context: string): number {
  const parsedValue = parseInteger(value, context);
  if (parsedValue < minimumNonNegativeInteger) {
    throw new Error(`${context} must be a non-negative integer`);
  }
  return parsedValue;
}

function parseMinimumNumber(value: unknown, minimum: number, context: string): number {
  if (typeof value !== "number") {
    throw new Error(`${context} must be a finite number of at least ${minimum}`);
  }
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${context} must be a finite number of at least ${minimum}`);
  }
  return value;
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

function assertExpectedProperties(
  record: Readonly<Record<string, unknown>>,
  allowedPropertyNames: readonly string[],
  requiredPropertyNames: readonly string[],
  context: string,
): void {
  for (const propertyName of requiredPropertyNames) {
    requireProperty(record, propertyName, context);
  }
  for (const propertyName of Object.keys(record)) {
    if (!allowedPropertyNames.includes(propertyName)) {
      throw new Error(`${context} does not support property ${propertyName}`);
    }
  }
}

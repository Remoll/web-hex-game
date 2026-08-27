import { Faction } from "@/game/faction/Faction";
import { MovementType, type HexCoord } from "@/game/types";
import {
  defaultTacticalAttributes,
  deriveMaximumHp,
  deriveMeleeDamage,
  deriveTempo,
  deriveViewRange,
  resolveTacticalAttributes,
  type TacticalAttributeInput,
  type TacticalAttributes,
} from "@/game/unit/tacticalAttributes/TacticalAttributes";

/**
 * Stable visual keys owned by the game domain. The renderer maps them to its
 * atlas sprites without exposing rendering details to game state.
 */
export enum UnitTexture {
  PlayerIdle = "player-idle",
  EnemyIdle = "enemy-idle",
}

/** Stable gameplay identity; it is never inferred from a sprite or display name. */
export enum UnitTacticalRole {
  None = "none",
  Mage = "mage",
}

export const defaultMageViewRange = 4;

export interface UnitConfig {
  readonly faction: Faction;
  readonly movementType: MovementType;
  readonly movementRange: number;
  /** Omitted units spawn at their Vitality-derived maximum HP. */
  readonly currentHp?: number;
  readonly attackPower: number;
  readonly tacticalRole: UnitTacticalRole;
  readonly viewRange?: number;
  readonly attributes: TacticalAttributes;
}

/** Supports compact serialized input while resolving all four scores in Unit. */
export type UnitConfigInput = Omit<Partial<UnitConfig>, "attributes"> & {
  readonly attributes?: TacticalAttributeInput;
};

/**
 * Defaults keep generic units compatible while static level definitions omit
 * derived and runtime-only state.
 */
export const defaultUnitConfig: UnitConfig = {
  faction: Faction.Enemy,
  movementType: MovementType.Ground,
  movementRange: 3,
  attackPower: 20,
  tacticalRole: UnitTacticalRole.None,
  attributes: defaultTacticalAttributes,
};

export class Unit {
  private _position: HexCoord;
  private _currentHp: number;

  constructor(
    public readonly id: string,
    initialPosition: HexCoord,
    public readonly texture: UnitTexture,
    config: UnitConfigInput = {},
  ) {
    const resolvedConfig: UnitConfig = {
      ...defaultUnitConfig,
      ...config,
      attributes: resolveTacticalAttributes(config.attributes),
    };

    validateBaseConfig(resolvedConfig, id);
    this._position = { ...initialPosition };
    this.faction = resolvedConfig.faction;
    this.movementType = resolvedConfig.movementType;
    this.movementRange = resolvedConfig.movementRange;
    this.attributes = resolvedConfig.attributes;
    this.maxHp = deriveMaximumHp(this.attributes);
    const initialCurrentHp = resolvedConfig.currentHp ?? this.maxHp;
    validateCurrentHp(initialCurrentHp, this.maxHp, id);
    this._currentHp = initialCurrentHp;
    this.attackPower = deriveMeleeDamage(resolvedConfig.attackPower, this.attributes);
    this.tempo = deriveTempo(this.attributes);
    this.tacticalRole = resolvedConfig.tacticalRole;
    this.viewRange = resolvedConfig.viewRange === undefined
      ? undefined
      : deriveViewRange(resolvedConfig.viewRange, this.attributes);
  }

  public readonly faction: Faction;
  public readonly movementType: MovementType;
  public readonly movementRange: number;
  public readonly attributes: TacticalAttributes;
  public readonly maxHp: number;
  public readonly attackPower: number;
  public readonly tempo: number;
  public readonly tacticalRole: UnitTacticalRole;
  public readonly viewRange: number | undefined;

  get position(): HexCoord {
    return { ...this._position };
  }

  get currentHp(): number {
    return this._currentHp;
  }

  get isAlive(): boolean {
    return this._currentHp > 0;
  }

  public moveTo(newHex: HexCoord): void {
    if (!this.isAlive) {
      throw new Error(`Defeated unit ${this.id} cannot move`);
    }

    this._position = { ...newHex };
  }

  /** Applies non-negative damage and clamps health at zero. */
  public receiveDamage(damage: number): void {
    if (!Number.isFinite(damage) || damage < 0) {
      throw new Error("Damage must be a non-negative finite number");
    }

    this._currentHp = Math.max(0, this._currentHp - damage);
  }
}

function validateBaseConfig(config: UnitConfig, unitId: string): void {
  if (!Number.isInteger(config.movementRange) || config.movementRange < 0) {
    throw new Error(`Unit ${unitId} must have a non-negative integer movement range`);
  }

  if (!Number.isInteger(config.attackPower) || config.attackPower < 0) {
    throw new Error(`Unit ${unitId} must have a non-negative integer attack power`);
  }

  if (config.tacticalRole === UnitTacticalRole.Mage) {
    const mageViewRange = config.viewRange;
    if (mageViewRange === undefined
      || !Number.isInteger(mageViewRange)
      || mageViewRange <= 0) {
      throw new Error(`Mage unit ${unitId} must have a positive integer view range`);
    }
    return;
  }

  if (config.viewRange !== undefined) {
    throw new Error(`Only Mage unit ${unitId} can define a view range`);
  }
}

function validateCurrentHp(
  currentHp: number,
  maximumHp: number,
  unitId: string,
): void {
  if (!Number.isInteger(currentHp) || currentHp < 0 || currentHp > maximumHp) {
    throw new Error(`Unit ${unitId} must have current HP between zero and maximum HP`);
  }
}

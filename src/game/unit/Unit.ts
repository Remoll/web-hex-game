import { Faction } from "@/game/faction/Faction";
import { MovementType, type HexCoord } from "@/game/types";

/**
 * Stable visual keys owned by the game domain. The renderer maps them to its
 * atlas sprites without exposing rendering details to game state.
 */
export enum UnitTexture {
  PlayerIdle = "player-idle",
  EnemyIdle = "enemy-idle",
}

export interface UnitConfig {
  readonly faction: Faction;
  readonly movementType: MovementType;
  readonly movementRange: number;
  readonly maxHp: number;
  readonly currentHp: number;
  readonly attackPower: number;
}

/**
 * Defaults preserve compatibility for callers that construct a generic unit
 * directly. Serialized levels always provide the complete configuration.
 */
export const defaultUnitConfig: UnitConfig = {
  faction: Faction.Enemy,
  movementType: MovementType.Ground,
  movementRange: 3,
  maxHp: 100,
  currentHp: 100,
  attackPower: 20,
};

export class Unit {
  private _position: HexCoord;
  private _currentHp: number;
  private _remainingMovement: number;
  private _remainingActions: number;

  constructor(
    public readonly id: string,
    initialPosition: HexCoord,
    public readonly texture: UnitTexture,
    config: Partial<UnitConfig> = {},
  ) {
    const resolvedConfig: UnitConfig = {
      ...defaultUnitConfig,
      ...config,
    };

    validateConfig(resolvedConfig, id);
    this._position = { ...initialPosition };
    this.faction = resolvedConfig.faction;
    this.movementType = resolvedConfig.movementType;
    this.movementRange = resolvedConfig.movementRange;
    this.maxHp = resolvedConfig.maxHp;
    this._currentHp = resolvedConfig.currentHp;
    this.attackPower = resolvedConfig.attackPower;
    this._remainingMovement = this.isAlive ? this.movementRange : 0;
    this._remainingActions = this.isAlive ? 1 : 0;
  }

  public readonly faction: Faction;
  public readonly movementType: MovementType;
  public readonly movementRange: number;
  public readonly maxHp: number;
  public readonly attackPower: number;

  get position(): HexCoord {
    return { ...this._position };
  }

  get currentHp(): number {
    return this._currentHp;
  }

  get remainingMovement(): number {
    return this._remainingMovement;
  }

  get remainingActions(): number {
    return this._remainingActions;
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
    if (!this.isAlive) {
      this.exhaustRoundBudget();
    }
  }

  /** Consumes movement points after a legal path has been resolved. */
  public spendMovement(cost: number): void {
    if (!this.isAlive) {
      throw new Error(`Defeated unit ${this.id} cannot spend movement`);
    }

    if (!Number.isInteger(cost) || cost < 0 || cost > this._remainingMovement) {
      throw new Error(`Unit ${this.id} cannot spend ${cost} movement`);
    }

    this._remainingMovement -= cost;
  }

  /**
   * Ends the unit's current allowance. The combat system uses this after an
   * attack; defeat also uses it to prevent further interaction.
   */
  public exhaustRoundBudget(): void {
    this._remainingMovement = 0;
    this._remainingActions = 0;
  }

  /** Future turn/round orchestration calls this to restore a living unit. */
  public resetRoundBudget(): void {
    this._remainingMovement = this.isAlive ? this.movementRange : 0;
    this._remainingActions = this.isAlive ? 1 : 0;
  }
}

function validateConfig(config: UnitConfig, unitId: string): void {
  if (!Number.isInteger(config.movementRange) || config.movementRange < 0) {
    throw new Error(`Unit ${unitId} must have a non-negative integer movement range`);
  }

  if (!Number.isInteger(config.maxHp) || config.maxHp <= 0) {
    throw new Error(`Unit ${unitId} must have a positive integer maximum HP`);
  }

  if (!Number.isInteger(config.currentHp)
    || config.currentHp < 0
    || config.currentHp > config.maxHp) {
    throw new Error(`Unit ${unitId} must have current HP between zero and maximum HP`);
  }

  if (!Number.isInteger(config.attackPower) || config.attackPower < 0) {
    throw new Error(`Unit ${unitId} must have a non-negative integer attack power`);
  }
}

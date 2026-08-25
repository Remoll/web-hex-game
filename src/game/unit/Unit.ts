import type { HexCoord } from "@/game/types";

/**
 * Stable visual keys owned by the game domain. The renderer maps them to its
 * atlas sprites without exposing rendering details to game state.
 */
export enum UnitTexture {
  PlayerIdle = "player-idle",
  EnemyIdle = "enemy-idle",
}

export class Unit {
  private _position: HexCoord;

  constructor(
    public readonly id: string,
    initialPosition: HexCoord,
    public readonly texture: UnitTexture,
  ) {
    this._position = { ...initialPosition };
  }

  get position(): HexCoord {
    return { ...this._position };
  }

  public moveTo(newHex: HexCoord): void {
    this._position = { ...newHex };
  }
}

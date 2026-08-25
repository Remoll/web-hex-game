import type { HexCoord } from "@/game/types";

export abstract class Unit {
  private _position: HexCoord;

  constructor(
    public readonly id: string,
    initialPosition: HexCoord,
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

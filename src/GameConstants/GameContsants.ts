export class GameConstants {
  private static _SIZE: number;
  private static _BORDER_WIDTH: number;
  private static _HEX_DEPTH: number;
  private static _UNITS_HEIGHT: number;
  private static _UNITS_WIDTH: number;

  private static isInitialized: boolean = false;

  static init(
    SIZE: number,
    BORDER_WIDTH: number,
    HEX_DEPTH: number,
    UNITS_HEIGHT: number,
    UNITS_WIDTH: number,
  ): void {
    if (GameConstants.isInitialized) {
      throw Error("GameConstants is already initialized");
    }

    GameConstants._SIZE = SIZE;
    GameConstants._BORDER_WIDTH = BORDER_WIDTH;
    GameConstants._HEX_DEPTH = HEX_DEPTH;
    GameConstants._UNITS_HEIGHT = UNITS_HEIGHT;
    GameConstants._UNITS_WIDTH = UNITS_WIDTH;

    GameConstants.isInitialized = true;
  }

  static get SIZE(): number {
    return GameConstants._SIZE;
  }

  static get BORDER_WIDTH(): number {
    return GameConstants._BORDER_WIDTH;
  }

  static get HEX_DEPTH(): number {
    return GameConstants._HEX_DEPTH;
  }

  static get UNITS_HEIGHT(): number {
    return GameConstants._UNITS_HEIGHT;
  }

  static get UNITS_WIDTH(): number {
    return GameConstants._UNITS_WIDTH;
  }
}

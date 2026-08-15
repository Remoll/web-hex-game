import type { GameCamera } from "../camera/GameCamera";
import type { GameMap } from "../gameMap/GameMap";
import type { Player } from "../units/Player";

export class GameContext {
  private static _gameMap: GameMap;
  private static _gameCamera: GameCamera;
  private static _player: Player;

  private static isInitialized: boolean = false;

  static init(
    gameMap: GameMap,
    gameCamera: GameCamera,
    player: Player,
  ): void {
    if (GameContext.isInitialized) {
      throw Error("GameContext is already initialized");
    }

    GameContext._gameMap = gameMap;
    GameContext._gameCamera = gameCamera;
    GameContext._player = player;

    GameContext.isInitialized = true;
  }

  static get gameMap(): GameMap {
    return GameContext._gameMap;
  }

  static get gameCamera(): GameCamera {
    return GameContext._gameCamera;
  }

  static get player(): Player {
    return GameContext._player;
  }
}

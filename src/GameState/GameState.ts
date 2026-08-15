import type { GameCamera } from "../camera/GameCamera";
import type { GameMap } from "../gameMap/GameMap";
import type { Player } from "../units/Player";

export class GameState {
  private static singleton: GameState | null = null;

  private constructor(
    private readonly _gameMap: GameMap,
    private readonly _gameCamera: GameCamera,
    private readonly _player: Player,
  ) {}

  static initSingleton(
    gameMap: GameMap,
    gameCamera: GameCamera,
    player: Player,
  ): GameState {
    if (GameState.singleton) {
      throw Error("GameState singleton is already initialized");
    }

    GameState.singleton = new GameState(gameMap, gameCamera, player);
    return GameState.singleton;
  }

  static getSingleton(): GameState {
    if (!GameState.singleton) {
      throw Error("GameState singleton is not initialized");
    }

    return GameState.singleton;
  }

  get gameMap(): GameMap {
    return this._gameMap;
  }

  get gameCamera(): GameCamera {
    return this._gameCamera;
  }

  get player(): Player {
    return this._player;
  }
}

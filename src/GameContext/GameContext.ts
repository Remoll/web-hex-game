import type { GameCamera } from "../camera/GameCamera";
import type { GameMap } from "../gameMap/GameMap";
import type { Player } from "../units/Player";

export class GameContext {
  private static _gameMap: GameMap;
  private static _gameCamera: GameCamera;
  private static _player: Player;

  // GAME MAP
  static get gameMap(): GameMap {
    return GameContext._gameMap;
  }

  static set gameMap(gameMap) {
    if (GameContext.gameMap) {
      throw Error("gameMap is already initialized");
    }

    GameContext._gameMap = gameMap;
  }

  // GAME CAMERA
  static get gameCamera(): GameCamera {
    return GameContext._gameCamera;
  }

  static set gameCamera(gameCamera) {
    if (GameContext.gameCamera) {
      throw Error("gameCamera is already initialized");
    }

    GameContext._gameCamera = gameCamera;
  }

  // PLAYER
  static get player(): Player {
    return GameContext._player;
  }

  static set player(player) {
    if (GameContext.player) {
      throw Error("player is already initialized");
    }

    GameContext._player = player;
  }
}

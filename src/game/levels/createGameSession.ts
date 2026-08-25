import { GameMap } from "@/game/board/gameMap/GameMap";
import { GameSession } from "@/game/gameSession/GameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { Unit } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";

export interface LevelSession {
  readonly session: GameSession;
  readonly player: Player;
}

/** Builds the mutable domain state from a serializable level definition. */
export function createGameSession(level: LevelDefinition): LevelSession {
  const player = new Player(
    level.player.id,
    level.player.position,
    level.player.texture,
  );
  const units = level.units.map(
    ({ id, position, texture }) => new Unit(id, position, texture),
  );

  return {
    session: new GameSession(new GameMap(level.map), [player, ...units]),
    player,
  };
}

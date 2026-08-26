import { GameMap } from "@/game/board/gameMap/GameMap";
import { Faction } from "@/game/faction/Faction";
import { GameSession } from "@/game/gameSession/GameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import {
  defaultUnitConfig,
  Unit,
  type UnitConfig,
} from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";

export interface LevelSession {
  readonly session: GameSession;
  readonly player: Player;
}

/** Builds the mutable domain state from a serializable level definition. */
export function createGameSession(level: LevelDefinition): LevelSession {
  const playerConfig = getUnitConfig(level.player, Faction.Player);
  if (playerConfig.faction !== Faction.Player) {
    throw new Error("The level player must use the player faction");
  }

  const player = new Player(
    level.player.id,
    level.player.position,
    level.player.texture,
    withoutFaction(playerConfig),
  );
  const units = level.units.map(
    (definition) => new Unit(
      definition.id,
      definition.position,
      definition.texture,
      getUnitConfig(definition, Faction.Enemy),
    ),
  );

  return {
    session: new GameSession(new GameMap(level.map), [player, ...units]),
    player,
  };
}

function getUnitConfig(
  definition: LevelDefinition["player"],
  fallbackFaction: Faction,
): UnitConfig {
  return {
    faction: definition.faction ?? fallbackFaction,
    movementType: definition.movementType ?? defaultUnitConfig.movementType,
    movementRange: definition.movementRange ?? defaultUnitConfig.movementRange,
    maxHp: definition.maxHp ?? defaultUnitConfig.maxHp,
    currentHp: definition.currentHp ?? defaultUnitConfig.currentHp,
    attackPower: definition.attackPower ?? defaultUnitConfig.attackPower,
  };
}

function withoutFaction(config: UnitConfig): Omit<UnitConfig, "faction"> {
  const { faction: _faction, ...playerConfig } = config;
  return playerConfig;
}

import { GameMap } from "@/game/board/gameMap/GameMap";
import { Faction } from "@/game/faction/Faction";
import { GameSession } from "@/game/gameSession/GameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import {
  defaultMageViewRange,
  defaultUnitConfig,
  Unit,
  type UnitConfig,
  UnitTacticalRole,
} from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";

export interface LevelSession {
  readonly session: GameSession;
  readonly player: Player;
}

/** Builds the mutable domain state from a serializable level definition. */
export function createGameSession(level: LevelDefinition): LevelSession {
  const playerConfig = getUnitConfig(
    level.player,
    Faction.Player,
    UnitTacticalRole.Mage,
  );
  if (playerConfig.faction !== Faction.Player) {
    throw new Error("The level player must use the player faction");
  }
  if (playerConfig.tacticalRole !== UnitTacticalRole.Mage) {
    throw new Error("The level player must use the mage tactical role");
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
      getUnitConfig(definition, Faction.Enemy, UnitTacticalRole.None),
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
  fallbackTacticalRole: UnitTacticalRole,
): UnitConfig {
  const tacticalRole = definition.tacticalRole ?? fallbackTacticalRole;

  return {
    faction: definition.faction ?? fallbackFaction,
    movementType: definition.movementType ?? defaultUnitConfig.movementType,
    movementRange: definition.movementRange ?? defaultUnitConfig.movementRange,
    maxHp: definition.maxHp ?? defaultUnitConfig.maxHp,
    currentHp: definition.currentHp ?? defaultUnitConfig.currentHp,
    attackPower: definition.attackPower ?? defaultUnitConfig.attackPower,
    tacticalRole,
    viewRange: definition.viewRange
      ?? (tacticalRole === UnitTacticalRole.Mage ? defaultMageViewRange : undefined),
  };
}

function withoutFaction(
  config: UnitConfig,
): Omit<UnitConfig, "faction" | "tacticalRole"> {
  return {
    movementType: config.movementType,
    movementRange: config.movementRange,
    maxHp: config.maxHp,
    currentHp: config.currentHp,
    attackPower: config.attackPower,
    viewRange: config.viewRange,
  };
}

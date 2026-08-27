import { Faction } from "@/game/faction/Faction";
import {
  defaultMageViewRange,
  Unit,
  type UnitConfig,
  UnitTacticalRole,
  type UnitTexture,
} from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";

export class Player extends Unit {
  constructor(
    id: string,
    initialPosition: HexCoord,
    texture: UnitTexture,
    config: Partial<Omit<UnitConfig, "faction" | "tacticalRole">> = {},
  ) {
    super(id, initialPosition, texture, {
      ...config,
      faction: Faction.Player,
      tacticalRole: UnitTacticalRole.Mage,
      viewRange: config.viewRange ?? defaultMageViewRange,
    });
  }
}

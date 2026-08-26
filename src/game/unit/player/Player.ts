import { Faction } from "@/game/faction/Faction";
import {
  Unit,
  type UnitConfig,
  type UnitTexture,
} from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";

export class Player extends Unit {
  constructor(
    id: string,
    initialPosition: HexCoord,
    texture: UnitTexture,
    config: Partial<Omit<UnitConfig, "faction">> = {},
  ) {
    super(id, initialPosition, texture, { ...config, faction: Faction.Player });
  }
}

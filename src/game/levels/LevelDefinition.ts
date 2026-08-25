import type { HexCoord, MapArray } from "@/game/types";
import type { UnitTexture } from "@/game/unit/Unit";

export interface UnitDefinition {
  readonly id: string;
  readonly position: HexCoord;
  readonly texture: UnitTexture;
}

/** Serializable data needed to create one playable level. */
export interface LevelDefinition {
  readonly map: MapArray;
  readonly player: UnitDefinition;
  readonly units: readonly UnitDefinition[];
}

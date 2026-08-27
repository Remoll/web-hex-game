import type { Faction } from "@/game/faction/Faction";
import type { HexCoord, MapArray } from "@/game/types";
import type { UnitTacticalRole, UnitTexture } from "@/game/unit/Unit";
import type { MovementType } from "@/game/types";

export interface UnitDefinition {
  readonly id: string;
  readonly position: HexCoord;
  readonly texture: UnitTexture;
  /** Explicit for newly-authored levels; optional fields support legacy saves. */
  readonly faction?: Faction;
  readonly movementType?: MovementType;
  readonly movementRange?: number;
  readonly maxHp?: number;
  readonly currentHp?: number;
  readonly attackPower?: number;
  readonly tacticalRole?: UnitTacticalRole;
  readonly viewRange?: number;
}

/** Serializable data needed to create one playable level. */
export interface LevelDefinition {
  readonly map: MapArray;
  readonly player: UnitDefinition;
  readonly units: readonly UnitDefinition[];
}

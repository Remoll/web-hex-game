import type { Faction } from "@/game/faction/Faction";
import type { HexCoord, MapArray } from "@/game/types";
import type { UnitTacticalRole, UnitTexture } from "@/game/unit/Unit";
import type { MovementType } from "@/game/types";
import type { TacticalAttributeInput } from "@/game/unit/tacticalAttributes/TacticalAttributes";

export interface UnitDefinition {
  readonly id: string;
  readonly position: HexCoord;
  readonly texture: UnitTexture;
  /** Optional fields use domain defaults when omitted from a static level. */
  readonly faction?: Faction;
  readonly movementType?: MovementType;
  readonly movementRange?: number;
  /** Runtime campaign state may restore a living unit below its maximum HP. */
  readonly currentHp?: number;
  readonly attackPower?: number;
  readonly tacticalRole?: UnitTacticalRole;
  readonly viewRange?: number;
  readonly attributes?: TacticalAttributeInput;
}

/** Serializable data needed to create one playable level. */
export interface LevelDefinition {
  readonly map: MapArray;
  readonly player: UnitDefinition;
  readonly units: readonly UnitDefinition[];
}

import type { GameMap } from "@/game/board/gameMap/GameMap";
import {
  Unit,
  UnitTacticalRole,
} from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";
import { hasElevationLineOfSight } from "@/game/visibility/ElevationLineOfSight";

/** Serializable tactical fog states, ordered from no knowledge to full sight. */
export enum FieldVisibility {
  Undiscovered = "undiscovered",
  Discovered = "discovered",
  Visible = "visible",
}

/** Read-only boundary shared by application and rendering adapters. */
export interface FieldVisibilityReader {
  getFieldVisibility(coord: HexCoord): FieldVisibility | undefined;
}

/**
 * Maintains historical discovery and current Mage vision without depending on
 * presentation state. Recalculation is invoked only by resolved game events.
 */
export class MageVisibility implements FieldVisibilityReader {
  private readonly visibilityByHex = new Map<string, FieldVisibility>();

  constructor(private readonly gameMap: GameMap) {
    this.gameMap.forEachField((q, r) => {
      this.visibilityByHex.set(getCoordKey({ q, r }), FieldVisibility.Undiscovered);
    });
  }

  getFieldVisibility(coord: HexCoord): FieldVisibility | undefined {
    return this.visibilityByHex.get(getCoordKey(coord));
  }

  recalculate(mage: Unit): void {
    const hasMageVision = mage.isAlive
      && mage.tacticalRole === UnitTacticalRole.Mage;
    const magePosition = mage.position;

    this.gameMap.forEachField((q, r) => {
      const coord = { q, r };
      const key = getCoordKey(coord);
      const previous = this.visibilityByHex.get(key) ?? FieldVisibility.Undiscovered;
      const isVisible = hasMageVision
        && this.gameMap.getHexDistance(magePosition, coord) <= mage.viewRange
        && hasElevationLineOfSight(this.gameMap, magePosition, coord);

      this.visibilityByHex.set(
        key,
        isVisible
          ? FieldVisibility.Visible
          : previous === FieldVisibility.Undiscovered
            ? FieldVisibility.Undiscovered
            : FieldVisibility.Discovered,
      );
    });
  }
}

function getCoordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

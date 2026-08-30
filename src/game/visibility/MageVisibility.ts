import type { GameMap } from "@/game/board/gameMap/GameMap";
import { getHexCoordKey } from "@/game/board/hexCoord/HexCoord";
import {
  Unit,
  UnitTacticalRole,
} from "@/game/unit/Unit";
import type { HexCoord } from "@/game/types";
import {
  hasElevationLineOfSight,
  type IsSightLineBlocked,
} from "@/game/visibility/ElevationLineOfSight";

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

/** Persistent discovery state for one map; current sight is always recalculated. */
export interface MageDiscoverySnapshot {
  readonly discoveredCoordinates: readonly HexCoord[];
}

/**
 * Maintains historical discovery and current Mage vision without depending on
 * presentation state. Recalculation is invoked only by resolved game events.
 */
export class MageVisibility implements FieldVisibilityReader {
  private readonly visibilityByHex = new Map<string, FieldVisibility>();

  constructor(
    private readonly gameMap: GameMap,
    private readonly isSightLineBlocked: IsSightLineBlocked = (coord) =>
      gameMap.isSightBlockedByStructure(coord),
  ) {
    this.gameMap.forEachField((q, r) => {
      this.visibilityByHex.set(
        getHexCoordKey({ q, r }),
        FieldVisibility.Undiscovered,
      );
    });
  }

  getFieldVisibility(coord: HexCoord): FieldVisibility | undefined {
    return this.visibilityByHex.get(getHexCoordKey(coord));
  }

  /** Captures known fields without exposing the internal visibility map. */
  getDiscoverySnapshot(): MageDiscoverySnapshot {
    const discoveredCoordinates: HexCoord[] = [];
    this.gameMap.forEachField((q, r) => {
      const coordinate = { q, r };
      if (this.getFieldVisibility(coordinate) !== FieldVisibility.Undiscovered) {
        discoveredCoordinates.push(coordinate);
      }
    });
    return { discoveredCoordinates: Object.freeze(discoveredCoordinates) };
  }

  /** Restores historical knowledge, while preserving fields currently visible. */
  restoreDiscoverySnapshot(snapshot: MageDiscoverySnapshot): void {
    for (const coordinate of snapshot.discoveredCoordinates) {
      const key = getHexCoordKey(coordinate);
      const currentVisibility = this.visibilityByHex.get(key);
      if (currentVisibility === undefined) {
        throw new Error(`Cannot restore discovery outside the map at ${coordinate.q},${coordinate.r}`);
      }
      if (currentVisibility !== FieldVisibility.Visible) {
        this.visibilityByHex.set(key, FieldVisibility.Discovered);
      }
    }
  }

  recalculate(mage: Unit): void {
    const hasMageVision = mage.isAlive
      && mage.tacticalRole === UnitTacticalRole.Mage;
    const magePosition = mage.position;

    this.gameMap.forEachField((q, r) => {
      const coord = { q, r };
      const key = getHexCoordKey(coord);
      const previous = this.visibilityByHex.get(key) ?? FieldVisibility.Undiscovered;
      const isVisible = hasMageVision
        && this.gameMap.getHexDistance(magePosition, coord) <= mage.viewRange
        && hasElevationLineOfSight(
          this.gameMap,
          magePosition,
          coord,
          this.isSightLineBlocked,
        );

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

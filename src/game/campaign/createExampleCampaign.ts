import {
  CampaignAreaKind,
  TacticalEntryDirection,
  type CampaignDefinition,
} from "@/game/campaign/CampaignDefinition";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { Faction } from "@/game/faction/Faction";
import {
  TerrainType,
  MovementType,
  type HexCoord,
  type MapArray,
} from "@/game/types";

export const strategicAreaId = "strategic-overworld";
export const existingTacticalAreaId = "existing-tactical-map";
export const towerGroundAreaId = "cobblestone-tower-ground";
export const strategicTacticalRouteId = "strategic-to-existing-tactical";
export const tacticalStrategicRouteId = "existing-tactical-to-strategic";
export const strategicTowerGroundRouteId = "strategic-to-cobblestone-tower-ground";
export const towerGroundStrategicRouteId = "cobblestone-tower-ground-to-strategic";
export const strategicMapRadius = 4;

const strategicInitialPartyPosition = { q: 0, r: 0 };
const strategicTacticalRouteCoordinate = { q: strategicMapRadius, r: 0 };
export const strategicTowerEntranceCoordinate = { q: -strategicMapRadius, r: 0 };
const tacticalRouteCoordinate = { q: -6, r: 0 };
const tacticalEntryDirection = TacticalEntryDirection.East;
const towerGroundEntryDirection = TacticalEntryDirection.East;
const groundLevel = 0;
const standardLeavingCostMultiplier = 1;

/** Builds the initial strategic, encounter, and safe tower-ground campaign graph. */
export function createExampleCampaign(
  tacticalLevel: LevelDefinition,
  towerGroundLevel: LevelDefinition,
): CampaignDefinition {
  const towerGroundEntryCoordinate: HexCoord = {
    ...towerGroundLevel.player.position,
  };

  return {
    initialAreaId: strategicAreaId,
    party: {
      mage: tacticalLevel.player,
      servants: tacticalLevel.units.filter((unit) => unit.faction === Faction.Player),
    },
    areas: [
      {
        id: strategicAreaId,
        displayName: "Strategic Map",
        kind: CampaignAreaKind.Strategic,
        map: createStrategicMap(),
        initialPartyPosition: strategicInitialPartyPosition,
      },
      {
        id: existingTacticalAreaId,
        displayName: "Existing Tactical Map",
        kind: CampaignAreaKind.Tactical,
        level: tacticalLevel,
      },
      {
        id: towerGroundAreaId,
        displayName: "Cobblestone Tower Ground Floor",
        kind: CampaignAreaKind.Tactical,
        level: towerGroundLevel,
      },
    ],
    routes: [
      {
        id: strategicTacticalRouteId,
        reciprocalRouteId: tacticalStrategicRouteId,
        from: {
          areaId: strategicAreaId,
          coordinate: strategicTacticalRouteCoordinate,
        },
        to: {
          areaId: existingTacticalAreaId,
          coordinate: tacticalRouteCoordinate,
          tacticalEntryDirection,
        },
      },
      {
        id: tacticalStrategicRouteId,
        reciprocalRouteId: strategicTacticalRouteId,
        from: {
          areaId: existingTacticalAreaId,
          coordinate: tacticalRouteCoordinate,
          tacticalEntryDirection,
        },
        to: {
          areaId: strategicAreaId,
          coordinate: strategicTacticalRouteCoordinate,
        },
      },
      {
        id: strategicTowerGroundRouteId,
        reciprocalRouteId: towerGroundStrategicRouteId,
        from: {
          areaId: strategicAreaId,
          coordinate: strategicTowerEntranceCoordinate,
        },
        to: {
          areaId: towerGroundAreaId,
          coordinate: towerGroundEntryCoordinate,
          tacticalEntryDirection: towerGroundEntryDirection,
        },
      },
      {
        id: towerGroundStrategicRouteId,
        reciprocalRouteId: strategicTowerGroundRouteId,
        from: {
          areaId: towerGroundAreaId,
          coordinate: towerGroundEntryCoordinate,
          tacticalEntryDirection: towerGroundEntryDirection,
        },
        to: {
          areaId: strategicAreaId,
          coordinate: strategicTowerEntranceCoordinate,
        },
      },
    ],
  };
}

function createStrategicMap(): MapArray {
  const fields: MapArray = [];
  for (let q = -strategicMapRadius; q <= strategicMapRadius; q += 1) {
    const minimumR = Math.max(-strategicMapRadius, -q - strategicMapRadius);
    const maximumR = Math.min(strategicMapRadius, -q + strategicMapRadius);
    for (let r = minimumR; r <= maximumR; r += 1) {
      fields.push({
        q,
        r,
        fieldAttrs: {
          terrainType: TerrainType.Grass,
          allowedMovements: {
            [MovementType.Ground]: true,
            [MovementType.Flying]: true,
          },
          groundLevel,
          leavingCostMultiplier: standardLeavingCostMultiplier,
        },
      });
    }
  }
  return fields;
}

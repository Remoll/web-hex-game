import { describe, expect, it } from "vitest";
import {
  CampaignAreaKind,
  TacticalEntryDirection,
  validateCampaignDefinition,
  type CampaignDefinition,
} from "@/game/campaign/CampaignDefinition";
import { Faction } from "@/game/faction/Faction";
import { TerrainType, MovementType } from "@/game/types";
import { UnitTacticalRole, UnitTexture } from "@/game/unit/Unit";

const map = [{
  q: 0,
  r: 0,
  fieldAttrs: {
    terrainType: TerrainType.Grass,
    allowedMovements: {
      [MovementType.Ground]: true,
      [MovementType.Flying]: true,
    },
    groundLevel: 0,
    leavingCostMultiplier: 1,
  },
}];

const campaign: CampaignDefinition = {
  initialAreaId: "strategic",
  party: {
    mage: {
      id: "mage",
      position: { q: 0, r: 0 },
      texture: UnitTexture.PlayerIdle,
      faction: Faction.Player,
      tacticalRole: UnitTacticalRole.Mage,
    },
    servants: [],
  },
  areas: [
    {
      id: "strategic",
      displayName: "Strategic",
      kind: CampaignAreaKind.Strategic,
      map,
      initialPartyPosition: { q: 0, r: 0 },
    },
    {
      id: "tactical",
      displayName: "Tactical",
      kind: CampaignAreaKind.Tactical,
      level: { map, player: {
        id: "mage",
        position: { q: 0, r: 0 },
        texture: UnitTexture.PlayerIdle,
      }, units: [] },
    },
  ],
  routes: [
    {
      id: "enter",
      reciprocalRouteId: "return",
      from: { areaId: "strategic", coordinate: { q: 0, r: 0 } },
      to: {
        areaId: "tactical",
        coordinate: { q: 0, r: 0 },
        tacticalEntryDirection: TacticalEntryDirection.East,
      },
    },
    {
      id: "return",
      reciprocalRouteId: "enter",
      from: {
        areaId: "tactical",
        coordinate: { q: 0, r: 0 },
        tacticalEntryDirection: TacticalEntryDirection.East,
      },
      to: { areaId: "strategic", coordinate: { q: 0, r: 0 } },
    },
  ],
};

describe("validateCampaignDefinition", () => {
  it("accepts reciprocal route endpoints", () => {
    expect(() => validateCampaignDefinition(campaign)).not.toThrow();
  });

  it("rejects a route whose declared reciprocal does not return to its source", () => {
    const invalidCampaign: CampaignDefinition = {
      ...campaign,
      routes: [
        campaign.routes[0],
        {
          ...campaign.routes[1],
          from: {
            areaId: "tactical",
            coordinate: { q: 0, r: 0 },
            tacticalEntryDirection: TacticalEntryDirection.West,
          },
        },
      ],
    };

    expect(() => validateCampaignDefinition(invalidCampaign)).toThrow(
      "Campaign route enter is not reciprocal",
    );
  });
});

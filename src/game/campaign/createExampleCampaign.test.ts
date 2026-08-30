import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CampaignAreaKind,
  validateCampaignDefinition,
  type CampaignDefinition,
} from "@/game/campaign/CampaignDefinition";
import { CampaignSession } from "@/game/campaign/CampaignSession";
import {
  createExampleCampaign,
  existingTacticalAreaId,
  strategicAreaId,
  strategicMapRadius,
  strategicTowerEntranceCoordinate,
  strategicTowerGroundRouteId,
  towerGroundAreaId,
  towerGroundStrategicRouteId,
} from "@/game/campaign/createExampleCampaign";
import { actionPointsPerActivation } from "@/game/eventTimeline/EventTimeline";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { ServantStrategyType } from "@/game/unit/servantStrategy/ServantStrategy";

const exampleLevelPath = fileURLToPath(
  new URL("../../../public/levels/example.json", import.meta.url),
);
const towerGroundLevelPath = fileURLToPath(
  new URL("../../../public/levels/tower-ground.json", import.meta.url),
);
const strategicTowerTravelStepCount = strategicMapRadius;
const playerMageId = "player";
const firstServantId = "friendly-1";
const secondServantId = "friendly-2";
const expectedFirstServantTowerEntryPosition = { q: 1, r: 0 };
const expectedSecondServantTowerEntryPosition = { q: 0, r: 1 };
const towerSecureTargetHex = { q: 0, r: -1 };
const partyDamage = 20;
const invalidTowerEntranceCoordinate = { q: -(strategicMapRadius + 1), r: 0 };

async function loadExampleCampaign(): Promise<CampaignDefinition> {
  const [tacticalLevel, towerGroundLevel] = await Promise.all([
    loadLevelFixture(exampleLevelPath),
    loadLevelFixture(towerGroundLevelPath),
  ]);
  return createExampleCampaign(tacticalLevel, towerGroundLevel);
}

async function loadLevelFixture(levelPath: string): Promise<LevelDefinition> {
  return JSON.parse(await readFile(levelPath, "utf8")) as LevelDefinition;
}

describe("createExampleCampaign tower ground floor", () => {
  it("enters the safe ground floor in deterministic party formation and returns intact", async () => {
    const campaign = new CampaignSession(await loadExampleCampaign());
    const strategicArea = campaign.activeArea;
    if (strategicArea.kind !== CampaignAreaKind.Strategic) {
      throw new Error("The example campaign must start on the strategic map");
    }

    for (let step = 1; step <= strategicTowerTravelStepCount; step += 1) {
      expect(strategicArea.session.moveTo({ q: -step, r: 0 })).toBe(true);
    }
    expect(campaign.getAvailableRoute()?.id).toBe(strategicTowerGroundRouteId);

    const towerGroundArea = campaign.travelAvailableRoute().activeArea;
    if (towerGroundArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("The strategic tower route must enter a tactical ground floor");
    }
    expect(towerGroundArea.definition.id).toBe(towerGroundAreaId);
    expect(towerGroundArea.session.timelinePresentation).toMatchObject({
      readyActorId: playerMageId,
      readyActorActionPoints: actionPointsPerActivation,
    });
    expect(towerGroundArea.session.getUnit(playerMageId)?.position).toEqual(
      towerGroundArea.definition.level.player.position,
    );
    expect(towerGroundArea.session.getUnit(firstServantId)?.position).toEqual(
      expectedFirstServantTowerEntryPosition,
    );
    expect(towerGroundArea.session.getUnit(secondServantId)?.position).toEqual(
      expectedSecondServantTowerEntryPosition,
    );
    expect(campaign.getOutboundRoutes().map((route) => route.id)).toEqual([
      towerGroundStrategicRouteId,
    ]);

    const mage = towerGroundArea.session.getUnit(playerMageId);
    if (!mage) {
      throw new Error("The entered tower floor must contain the Mage");
    }
    mage.receiveDamage(partyDamage);

    const returnedStrategicArea = campaign.travelAvailableRoute().activeArea;
    if (returnedStrategicArea.kind !== CampaignAreaKind.Strategic) {
      throw new Error("The tower ground route must return to the strategic map");
    }
    expect(returnedStrategicArea.session.partyPosition).toEqual(
      strategicTowerEntranceCoordinate,
    );
    expect(campaign.party.find((member) => member.definition.id === playerMageId)
      ?.definition.currentHp).toBe(mage.maxHp - partyDamage);
  });

  it("clears a map-local Secure order before the party enters another tactical area", async () => {
    const campaign = new CampaignSession(await loadExampleCampaign());
    const strategicArea = campaign.activeArea;
    if (strategicArea.kind !== CampaignAreaKind.Strategic) {
      throw new Error("The example campaign must start on the strategic map");
    }

    for (let coordinateQ = -1; coordinateQ >= -strategicTowerTravelStepCount; coordinateQ -= 1) {
      expect(strategicArea.session.moveTo({ q: coordinateQ, r: 0 })).toBe(true);
    }

    const towerGroundArea = campaign.travelAvailableRoute().activeArea;
    if (towerGroundArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("The strategic tower route must enter a tactical ground floor");
    }
    expect(towerGroundArea.session.assignSecureDesignatedHexStrategyToServant(
      firstServantId,
      towerSecureTargetHex,
    )).toMatchObject({
      strategyType: ServantStrategyType.SecureDesignatedHex,
    });
    expect(towerGroundArea.session.getServantStrategyType(firstServantId)).toBe(
      ServantStrategyType.SecureDesignatedHex,
    );

    const returnedStrategicArea = campaign.travelAvailableRoute().activeArea;
    if (returnedStrategicArea.kind !== CampaignAreaKind.Strategic) {
      throw new Error("The tower ground route must return to the strategic map");
    }
    for (
      let coordinateQ = -strategicTowerTravelStepCount + 1;
      coordinateQ <= strategicMapRadius;
      coordinateQ += 1
    ) {
      expect(returnedStrategicArea.session.moveTo({ q: coordinateQ, r: 0 })).toBe(true);
    }

    const existingTacticalArea = campaign.travelAvailableRoute().activeArea;
    if (existingTacticalArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("The strategic route must enter the existing tactical map");
    }
    expect(existingTacticalArea.definition.id).toBe(existingTacticalAreaId);
    expect(existingTacticalArea.session.getServantStrategyType(firstServantId)).toBeUndefined();
  });

  it("rejects a tower entrance configured outside the strategic map", async () => {
    const campaign = await loadExampleCampaign();
    const invalidCampaign: CampaignDefinition = {
      ...campaign,
      routes: campaign.routes.map((route) => route.id === strategicTowerGroundRouteId
        ? {
          ...route,
          from: {
            ...route.from,
            coordinate: invalidTowerEntranceCoordinate,
          },
        }
        : route),
    };

    expect(() => validateCampaignDefinition(invalidCampaign)).toThrow(
      `Campaign route ${strategicTowerGroundRouteId} from coordinate is outside ${strategicAreaId}`,
    );
  });
});

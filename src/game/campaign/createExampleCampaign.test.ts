import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CampaignAreaKind,
  TacticalEntryDirection,
  validateCampaignDefinition,
  type CampaignDefinition,
} from "@/game/campaign/CampaignDefinition";
import { CampaignSession } from "@/game/campaign/CampaignSession";
import {
  createExampleCampaign,
  existingTacticalAreaId,
  strategicAreaId,
  strategicMapRadius,
  strategicStructureShowcaseEntranceCoordinate,
  strategicStructureShowcaseRouteId,
  strategicTowerEntranceCoordinate,
  strategicTowerGroundRouteId,
  towerGroundAreaId,
  towerGroundStrategicRouteId,
  towerGroundUpperRouteId,
  towerUpperAreaId,
  towerUpperGroundRouteId,
  structureShowcaseAreaId,
  structureShowcaseStrategicRouteId,
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
const towerUpperLevelPath = fileURLToPath(
  new URL("../../../public/levels/tower-upper.json", import.meta.url),
);
const structureShowcaseLevelPath = fileURLToPath(
  new URL("../../../public/levels/structure-showcase.json", import.meta.url),
);
const strategicTowerTravelStepCount = strategicMapRadius;
const playerMageId = "player";
const firstServantId = "friendly-1";
const secondServantId = "friendly-2";
const expectedFirstServantTowerEntryPosition = { q: 1, r: 0 };
const expectedSecondServantTowerEntryPosition = { q: 0, r: 1 };
const towerGroundUpperStairCoordinate = { q: 1, r: -1 };
const towerUpperGroundStairCoordinate = { q: -1, r: 0 };
const expectedFirstServantTowerUpperEntryPosition = { q: 0, r: 0 };
const expectedSecondServantTowerUpperEntryPosition = { q: -1, r: 1 };
const expectedFirstServantTowerGroundReturnPosition = { q: 0, r: -1 };
const expectedSecondServantTowerGroundReturnPosition = { q: 0, r: 0 };
const towerSecureTargetHex = { q: 0, r: -1 };
const partyDamage = 20;
const invalidTowerEntranceCoordinate = { q: -(strategicMapRadius + 1), r: 0 };

interface ExampleCampaignLevels {
  readonly tactical: LevelDefinition;
  readonly towerGround: LevelDefinition;
  readonly towerUpper: LevelDefinition;
  readonly structureShowcase: LevelDefinition;
}

async function loadExampleCampaign(): Promise<CampaignDefinition> {
  const levels = await loadExampleCampaignLevels();
  return createExampleCampaign(
    levels.tactical,
    levels.towerGround,
    levels.towerUpper,
    levels.structureShowcase,
  );
}

async function loadExampleCampaignLevels(): Promise<ExampleCampaignLevels> {
  const [tactical, towerGround, towerUpper, structureShowcase] = await Promise.all([
    loadLevelFixture(exampleLevelPath),
    loadLevelFixture(towerGroundLevelPath),
    loadLevelFixture(towerUpperLevelPath),
    loadLevelFixture(structureShowcaseLevelPath),
  ]);
  return { tactical, towerGround, towerUpper, structureShowcase };
}

async function loadLevelFixture(levelPath: string): Promise<LevelDefinition> {
  return JSON.parse(await readFile(levelPath, "utf8")) as LevelDefinition;
}

describe("createExampleCampaign tower routes", () => {
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
      towerGroundUpperRouteId,
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

  it("uses reciprocal Tactical-to-Tactical stair routes with persistent party state", async () => {
    const campaign = new CampaignSession(await loadExampleCampaign());
    const strategicArea = campaign.activeArea;
    if (strategicArea.kind !== CampaignAreaKind.Strategic) {
      throw new Error("The example campaign must start on the strategic map");
    }

    for (let step = 1; step <= strategicTowerTravelStepCount; step += 1) {
      expect(strategicArea.session.moveTo({ q: -step, r: 0 })).toBe(true);
    }

    const towerGroundArea = campaign.travelAvailableRoute().activeArea;
    if (towerGroundArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("The strategic tower route must enter a tactical ground floor");
    }
    const groundMage = towerGroundArea.session.getUnit(playerMageId);
    if (!groundMage) {
      throw new Error("The tower ground floor must contain the Mage");
    }
    groundMage.receiveDamage(partyDamage);
    expect(towerGroundArea.session.assignSecureDesignatedHexStrategyToServant(
      firstServantId,
      towerSecureTargetHex,
    )).toMatchObject({ strategyType: ServantStrategyType.SecureDesignatedHex });
    expect(towerGroundArea.session.clickHex(groundMage.position)).toMatchObject({
      unitId: playerMageId,
    });
    expect(towerGroundArea.session.clickHex(towerGroundUpperStairCoordinate)).toMatchObject({
      unitId: playerMageId,
      to: towerGroundUpperStairCoordinate,
    });
    expect(campaign.getAvailableRoute()?.id).toBe(towerGroundUpperRouteId);
    expect(campaign.getAvailableRoute()).toMatchObject({
      from: {
        coordinate: towerGroundUpperStairCoordinate,
        tacticalEntryDirection: TacticalEntryDirection.West,
      },
      to: {
        areaId: towerUpperAreaId,
        coordinate: towerUpperGroundStairCoordinate,
        tacticalEntryDirection: TacticalEntryDirection.East,
      },
    });

    const towerUpperArea = campaign.travelAvailableRoute().activeArea;
    if (towerUpperArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("The tower stair route must enter a tactical upper floor");
    }
    expect(towerUpperArea.definition.id).toBe(towerUpperAreaId);
    expect(towerUpperArea.session.timelinePresentation).toMatchObject({
      readyActorId: playerMageId,
      readyActorActionPoints: actionPointsPerActivation,
    });
    expect(towerUpperArea.session.getUnit(playerMageId)?.position).toEqual(
      towerUpperGroundStairCoordinate,
    );
    expect(towerUpperArea.session.getUnit(firstServantId)?.position).toEqual(
      expectedFirstServantTowerUpperEntryPosition,
    );
    expect(towerUpperArea.session.getUnit(secondServantId)?.position).toEqual(
      expectedSecondServantTowerUpperEntryPosition,
    );
    expect(towerUpperArea.session.getUnit(playerMageId)?.currentHp).toBe(
      groundMage.maxHp - partyDamage,
    );
    expect(towerUpperArea.session.getServantStrategyType(firstServantId)).toBeUndefined();
    expect(campaign.getAvailableRoute()?.id).toBe(towerUpperGroundRouteId);
    expect(campaign.getAvailableRoute()).toMatchObject({
      from: {
        coordinate: towerUpperGroundStairCoordinate,
        tacticalEntryDirection: TacticalEntryDirection.East,
      },
      to: {
        areaId: towerGroundAreaId,
        coordinate: towerGroundUpperStairCoordinate,
        tacticalEntryDirection: TacticalEntryDirection.West,
      },
    });

    const returnedTowerGroundArea = campaign.travelAvailableRoute().activeArea;
    if (returnedTowerGroundArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("The upper stair route must return to a tactical ground floor");
    }
    expect(returnedTowerGroundArea.definition.id).toBe(towerGroundAreaId);
    expect(returnedTowerGroundArea.session.timelinePresentation).toMatchObject({
      readyActorId: playerMageId,
      readyActorActionPoints: actionPointsPerActivation,
    });
    expect(returnedTowerGroundArea.session.getUnit(playerMageId)?.position).toEqual(
      towerGroundUpperStairCoordinate,
    );
    expect(returnedTowerGroundArea.session.getUnit(firstServantId)?.position).toEqual(
      expectedFirstServantTowerGroundReturnPosition,
    );
    expect(returnedTowerGroundArea.session.getUnit(secondServantId)?.position).toEqual(
      expectedSecondServantTowerGroundReturnPosition,
    );
    expect(returnedTowerGroundArea.session.getUnit(playerMageId)?.currentHp).toBe(
      groundMage.maxHp - partyDamage,
    );
    expect(returnedTowerGroundArea.session.getServantStrategyType(firstServantId)).toBeUndefined();
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

  it("enters the authored structure showcase from its third strategic entrance", async () => {
    const campaign = new CampaignSession(await loadExampleCampaign());
    const strategicArea = campaign.activeArea;
    if (strategicArea.kind !== CampaignAreaKind.Strategic) {
      throw new Error("The example campaign must start on the strategic map");
    }

    for (let coordinateR = -1; coordinateR >= -strategicMapRadius; coordinateR -= 1) {
      expect(strategicArea.session.moveTo({ q: 0, r: coordinateR })).toBe(true);
    }

    expect(strategicArea.session.partyPosition).toEqual(
      strategicStructureShowcaseEntranceCoordinate,
    );
    expect(campaign.getAvailableRoute()?.id).toBe(strategicStructureShowcaseRouteId);

    const showcaseArea = campaign.travelAvailableRoute().activeArea;
    if (showcaseArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("The structure showcase route must enter a tactical area");
    }
    expect(showcaseArea.definition.id).toBe(structureShowcaseAreaId);
    expect(showcaseArea.session.getUnit(playerMageId)?.position).toEqual({ q: -5, r: 0 });
    expect(showcaseArea.session.getUnit(firstServantId)?.position).toEqual({ q: -5, r: 1 });
    expect(showcaseArea.session.getUnit(secondServantId)?.position).toEqual({ q: -4, r: -1 });
    expect(campaign.getAvailableRoute()?.id).toBe(structureShowcaseStrategicRouteId);
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

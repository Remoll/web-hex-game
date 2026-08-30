import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CampaignAreaKind,
  TacticalEntryDirection,
  type CampaignDefinition,
} from "@/game/campaign/CampaignDefinition";
import { CampaignSession } from "@/game/campaign/CampaignSession";
import {
  createExampleCampaign,
  existingTacticalAreaId,
  strategicTowerEntranceCoordinate,
  strategicMapRadius,
} from "@/game/campaign/createExampleCampaign";
import { actionPointsPerActivation } from "@/game/eventTimeline/EventTimeline";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { ServantStrategyType } from "@/game/unit/servantStrategy/ServantStrategy";
import { UnitTexture } from "@/game/unit/Unit";
import { MovementType, TerrainType, type MapArray } from "@/game/types";

const exampleLevelPath = fileURLToPath(
  new URL("../../../public/levels/example.json", import.meta.url),
);
const towerGroundLevelPath = fileURLToPath(
  new URL("../../../public/levels/tower-ground.json", import.meta.url),
);
const partyDamage = 20;
const localEnemyDamage = 20;
const strategicStepsToExistingTacticalMap = strategicMapRadius;
const campaignMageId = "mage";
const sourceTacticalAreaId = "source-tactical";
const blockedTacticalAreaId = "blocked-tactical";
const strategicAreaId = "strategic";
const sourceEntryCoordinate = { q: 0, r: 0 };
const sourceBlockedRouteCoordinate = { q: 1, r: 0 };
const blockedEntryCoordinate = { q: 0, r: 0 };

async function createCampaignSession(): Promise<CampaignSession> {
  const [tacticalLevel, towerGroundLevel] = await Promise.all([
    loadLevelFixture(exampleLevelPath),
    loadLevelFixture(towerGroundLevelPath),
  ]);
  return new CampaignSession(createExampleCampaign(tacticalLevel, towerGroundLevel));
}

async function loadLevelFixture(levelPath: string): Promise<LevelDefinition> {
  return JSON.parse(await readFile(levelPath, "utf8")) as LevelDefinition;
}

describe("CampaignSession", () => {
  it("round-trips a living party and restores local tactical state without map-local orders", async () => {
    const campaign = await createCampaignSession();
    const strategicArea = campaign.activeArea;
    if (strategicArea.kind !== CampaignAreaKind.Strategic) {
      throw new Error("Campaign must start on the strategic map");
    }
    expect(strategicArea.session.gameMap.radiusInHex).toBe(strategicMapRadius);
    expect(campaign.getOutboundRoutes().map((route) => route.from.coordinate)).toEqual([
      { q: strategicMapRadius, r: 0 },
      strategicTowerEntranceCoordinate,
    ]);

    for (let step = 0; step < strategicStepsToExistingTacticalMap; step += 1) {
      expect(strategicArea.session.moveTo({ q: step + 1, r: 0 })).toBe(true);
    }

    const enteredTacticalArea = campaign.travelAvailableRoute().activeArea;
    if (enteredTacticalArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("Strategic route must enter the tactical area");
    }
    expect(enteredTacticalArea.definition.id).toBe(existingTacticalAreaId);
    expect(campaign.getOutboundRoutes().map((route) => route.from.coordinate)).toEqual([
      { q: -6, r: 0 },
    ]);
    expect(enteredTacticalArea.session.timelinePresentation).toMatchObject({
      readyActorId: enteredTacticalArea.mageId,
      readyActorActionPoints: actionPointsPerActivation,
    });
    expect(enteredTacticalArea.session.getUnit("player")?.position).toEqual({ q: -6, r: 0 });
    expect(enteredTacticalArea.session.getUnit("friendly-1")?.position).toEqual({ q: -5, r: 0 });
    expect(enteredTacticalArea.session.getUnit("friendly-2")?.position).toEqual({ q: -6, r: 1 });

    const mage = enteredTacticalArea.session.getUnit("player");
    const survivingServant = enteredTacticalArea.session.getUnit("friendly-1");
    const defeatedServant = enteredTacticalArea.session.getUnit("friendly-2");
    const localEnemy = enteredTacticalArea.session.getUnit("enemy-1");
    const defeatedLocalEnemy = enteredTacticalArea.session.getUnit("enemy-2");
    if (!mage || !survivingServant || !defeatedServant || !localEnemy || !defeatedLocalEnemy) {
      throw new Error("Expected example party and local Enemy");
    }
    mage.receiveDamage(partyDamage);
    survivingServant.receiveDamage(partyDamage);
    defeatedServant.receiveDamage(defeatedServant.maxHp);
    localEnemy.receiveDamage(localEnemyDamage);
    defeatedLocalEnemy.receiveDamage(defeatedLocalEnemy.maxHp);
    expect(enteredTacticalArea.session.assignHoldStrategyToServant(
      survivingServant.id,
    )).toMatchObject({ strategyType: ServantStrategyType.Hold });

    const returnedStrategicArea = campaign.travelAvailableRoute().activeArea;
    if (returnedStrategicArea.kind !== CampaignAreaKind.Strategic) {
      throw new Error("Tactical route must return to the strategic area");
    }
    expect(returnedStrategicArea.session.partyPosition).toEqual({
      q: strategicMapRadius,
      r: 0,
    });
    expect(campaign.party.map((member) => member.definition.id)).toEqual([
      "player",
      "friendly-1",
    ]);

    const restoredTacticalArea = campaign.travelAvailableRoute().activeArea;
    if (restoredTacticalArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("Strategic route must re-enter the tactical area");
    }
    expect(restoredTacticalArea.session.timelinePresentation).toMatchObject({
      readyActorId: restoredTacticalArea.mageId,
      readyActorActionPoints: actionPointsPerActivation,
    });
    expect(restoredTacticalArea.session.getUnit("player")?.currentHp).toBe(
      mage.maxHp - partyDamage,
    );
    expect(restoredTacticalArea.session.getUnit("friendly-1")?.currentHp).toBe(
      survivingServant.maxHp - partyDamage,
    );
    expect(restoredTacticalArea.session.getUnit("friendly-2")).toBeUndefined();
    expect(restoredTacticalArea.session.getServantStrategyType("friendly-1")).toBeUndefined();
    expect(restoredTacticalArea.session.getUnit("enemy-1")?.currentHp).toBe(
      localEnemy.maxHp - localEnemyDamage,
    );
    expect(restoredTacticalArea.session.getUnit("enemy-1")?.position).toEqual(
      localEnemy.position,
    );
    expect(restoredTacticalArea.session.getUnit("enemy-2")?.isAlive).toBe(false);
    expect(restoredTacticalArea.session.getUnitAt(defeatedLocalEnemy.position)).toBeUndefined();
  });

  it("keeps a tactical source and campaign state unchanged when destination entry is blocked", () => {
    const campaign = new CampaignSession(createBlockedEntryCampaignDefinition());
    const sourceArea = campaign.travelAvailableRoute().activeArea;
    if (sourceArea.kind !== CampaignAreaKind.Tactical) {
      throw new Error("Strategic route must enter the source tactical area");
    }
    const mage = sourceArea.session.getUnit(campaignMageId);
    if (!mage) {
      throw new Error("Source tactical Mage is missing");
    }
    mage.moveTo(sourceBlockedRouteCoordinate);
    const partyBeforeFailedTravel = campaign.party;

    expect(() => campaign.travelAvailableRoute()).toThrow(
      "The tactical entry formation slot for mage is unavailable",
    );

    expect(campaign.activeArea).toBe(sourceArea);
    expect(campaign.party).toEqual(partyBeforeFailedTravel);
    expect(sourceArea.session.getUnit(campaignMageId)?.position).toEqual(
      sourceBlockedRouteCoordinate,
    );
    expect(campaign.getAvailableRoute()?.id).toBe("source-to-blocked");
  });
});

function createBlockedEntryCampaignDefinition(): CampaignDefinition {
  const strategicMap: MapArray = [mapField(
    sourceEntryCoordinate.q,
    sourceEntryCoordinate.r,
  )];
  const sourceTacticalMap: MapArray = [
    mapField(sourceEntryCoordinate.q, sourceEntryCoordinate.r),
    mapField(sourceBlockedRouteCoordinate.q, sourceBlockedRouteCoordinate.r),
  ];
  const blockedTacticalMap: MapArray = [mapField(
    blockedEntryCoordinate.q,
    blockedEntryCoordinate.r,
  )];
  const mageDefinition = {
    id: campaignMageId,
    position: sourceEntryCoordinate,
    texture: UnitTexture.PlayerIdle,
  };
  const sourceLevel: LevelDefinition = {
    map: sourceTacticalMap,
    player: mageDefinition,
    units: [],
  };
  const blockedLevel: LevelDefinition = {
    map: blockedTacticalMap,
    player: mageDefinition,
    units: [{
      id: "blocking-enemy",
      position: blockedEntryCoordinate,
      texture: UnitTexture.EnemyIdle,
    }],
  };

  return {
    initialAreaId: strategicAreaId,
    party: { mage: mageDefinition, servants: [] },
    areas: [
      {
        id: strategicAreaId,
        displayName: "Strategic",
        kind: CampaignAreaKind.Strategic,
        map: strategicMap,
        initialPartyPosition: sourceEntryCoordinate,
      },
      {
        id: sourceTacticalAreaId,
        displayName: "Source",
        kind: CampaignAreaKind.Tactical,
        level: sourceLevel,
      },
      {
        id: blockedTacticalAreaId,
        displayName: "Blocked",
        kind: CampaignAreaKind.Tactical,
        level: blockedLevel,
      },
    ],
    routes: [
      {
        id: "strategic-to-source",
        reciprocalRouteId: "source-to-strategic",
        from: { areaId: strategicAreaId, coordinate: sourceEntryCoordinate },
        to: {
          areaId: sourceTacticalAreaId,
          coordinate: sourceEntryCoordinate,
          tacticalEntryDirection: TacticalEntryDirection.East,
        },
      },
      {
        id: "source-to-strategic",
        reciprocalRouteId: "strategic-to-source",
        from: {
          areaId: sourceTacticalAreaId,
          coordinate: sourceEntryCoordinate,
          tacticalEntryDirection: TacticalEntryDirection.East,
        },
        to: { areaId: strategicAreaId, coordinate: sourceEntryCoordinate },
      },
      {
        id: "source-to-blocked",
        reciprocalRouteId: "blocked-to-source",
        from: {
          areaId: sourceTacticalAreaId,
          coordinate: sourceBlockedRouteCoordinate,
          tacticalEntryDirection: TacticalEntryDirection.East,
        },
        to: {
          areaId: blockedTacticalAreaId,
          coordinate: blockedEntryCoordinate,
          tacticalEntryDirection: TacticalEntryDirection.East,
        },
      },
      {
        id: "blocked-to-source",
        reciprocalRouteId: "source-to-blocked",
        from: {
          areaId: blockedTacticalAreaId,
          coordinate: blockedEntryCoordinate,
          tacticalEntryDirection: TacticalEntryDirection.East,
        },
        to: {
          areaId: sourceTacticalAreaId,
          coordinate: sourceBlockedRouteCoordinate,
          tacticalEntryDirection: TacticalEntryDirection.East,
        },
      },
    ],
  };
}

function mapField(q: number, r: number) {
  return {
    q,
    r,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: {
        [MovementType.Ground]: true,
        [MovementType.Flying]: true,
      },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  };
}

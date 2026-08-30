import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  CampaignAreaKind,
  getCampaignArea,
  type CampaignAreaDefinition,
  type CampaignDefinition,
  type CampaignRouteDefinition,
  type TacticalAreaDefinition,
  validateCampaignDefinition,
} from "@/game/campaign/CampaignDefinition";
import { createTacticalEntryFormation } from "@/game/campaign/TacticalEntryFormation";
import {
  GameSession,
} from "@/game/gameSession/GameSession";
import type { LevelDefinition, UnitDefinition } from "@/game/levels/LevelDefinition";
import { createGameSession } from "@/game/levels/createGameSession";
import type { HexCoord } from "@/game/types";
import { StrategicSession } from "@/game/strategicSession/StrategicSession";
import type { MageDiscoverySnapshot } from "@/game/visibility/MageVisibility";

export interface PersistentPartyMember {
  readonly definition: UnitDefinition;
}

interface TacticalAreaRuntimeSnapshot {
  readonly localUnitDefinitions: readonly UnitDefinition[];
  readonly mageDiscovery: MageDiscoverySnapshot;
}

interface CampaignTravelSnapshot {
  readonly partyMembersById: ReadonlyMap<string, PersistentPartyMember>;
  readonly tacticalRuntimeByAreaId: ReadonlyMap<string, TacticalAreaRuntimeSnapshot>;
  readonly activeArea: ActiveCampaignArea;
}

export interface TacticalCampaignArea {
  readonly kind: CampaignAreaKind.Tactical;
  readonly definition: TacticalAreaDefinition;
  readonly session: GameSession;
  readonly mageId: string;
}

export interface StrategicCampaignArea {
  readonly kind: CampaignAreaKind.Strategic;
  readonly definition: Extract<CampaignAreaDefinition, { kind: CampaignAreaKind.Strategic }>;
  readonly session: StrategicSession;
  readonly mage: PersistentPartyMember;
}

export type ActiveCampaignArea = TacticalCampaignArea | StrategicCampaignArea;

export interface CampaignTravelResult {
  readonly route: CampaignRouteDefinition;
  readonly activeArea: ActiveCampaignArea;
}

/**
 * Owns campaign routes and the persistent party. Tactical rules stay inside a
 * materialized GameSession; strategic movement stays inside StrategicSession.
 */
export class CampaignSession {
  private readonly partyMembersById = new Map<string, PersistentPartyMember>();
  private readonly campaignPartyMemberIds = new Set<string>();
  private readonly tacticalRuntimeByAreaId = new Map<string, TacticalAreaRuntimeSnapshot>();
  private _activeArea: ActiveCampaignArea;

  constructor(private readonly definition: CampaignDefinition) {
    validateCampaignDefinition(definition);
    this.initializeParty(definition);
    const initialArea = getCampaignArea(definition, definition.initialAreaId);
    if (initialArea.kind !== CampaignAreaKind.Strategic) {
      throw new Error("WHG-118 campaign must begin in a Strategic area");
    }
    this._activeArea = this.createStrategicArea(initialArea);
  }

  get activeArea(): ActiveCampaignArea {
    return this._activeArea;
  }

  getAreaDefinition(areaId: string): CampaignAreaDefinition {
    return getCampaignArea(this.definition, areaId);
  }

  get party(): readonly PersistentPartyMember[] {
    return Object.freeze([...this.partyMembersById.values()].map(clonePartyMember));
  }

  getAvailableRoute(): CampaignRouteDefinition | undefined {
    const coordinate = this._activeArea.kind === CampaignAreaKind.Strategic
      ? this._activeArea.session.partyPosition
      : this.getTacticalMage(this._activeArea).position;
    return this.definition.routes.find((route) => route.from.areaId === this._activeArea.definition.id
      && route.from.coordinate.q === coordinate.q
      && route.from.coordinate.r === coordinate.r);
  }

  /** Public route endpoints are known map feedback before the party reaches one. */
  getOutboundRoutes(): readonly CampaignRouteDefinition[] {
    const activeAreaId = this._activeArea.definition.id;
    return Object.freeze(this.definition.routes.filter(
      (route) => route.from.areaId === activeAreaId,
    ));
  }

  /** Atomically persists the party, then switches through one validated route. */
  travelAvailableRoute(): CampaignTravelResult {
    const route = this.getAvailableRoute();
    if (!route) {
      throw new Error("The party is not at a campaign route endpoint");
    }

    const travelSnapshot = this.createTravelSnapshot();
    try {
      const destinationArea = getCampaignArea(this.definition, route.to.areaId);
      if (this._activeArea.kind === CampaignAreaKind.Tactical) {
        this.captureTacticalParty(this._activeArea);
      }

      if (destinationArea.kind === CampaignAreaKind.Strategic) {
        this._activeArea = this.createStrategicArea(destinationArea, route.to.coordinate);
      } else {
        const entryDirection = route.to.tacticalEntryDirection;
        if (!entryDirection) {
          throw new Error(`Tactical destination ${destinationArea.id} is missing an entry direction`);
        }
        this._activeArea = this.createTacticalArea(
          destinationArea,
          route.to.coordinate,
          entryDirection,
        );
      }

      return { route, activeArea: this._activeArea };
    } catch (error) {
      this.restoreTravelSnapshot(travelSnapshot);
      throw error;
    }
  }

  private initializeParty(definition: CampaignDefinition): void {
    const partyMembers = [definition.party.mage, ...definition.party.servants];
    for (const member of partyMembers) {
      this.campaignPartyMemberIds.add(member.id);
      this.partyMembersById.set(member.id, {
        definition: cloneUnitDefinition(member),
      });
    }
  }

  private createTravelSnapshot(): CampaignTravelSnapshot {
    return {
      partyMembersById: new Map(this.partyMembersById),
      tacticalRuntimeByAreaId: new Map(this.tacticalRuntimeByAreaId),
      activeArea: this._activeArea,
    };
  }

  private restoreTravelSnapshot(snapshot: CampaignTravelSnapshot): void {
    this.partyMembersById.clear();
    for (const [memberId, member] of snapshot.partyMembersById) {
      this.partyMembersById.set(memberId, member);
    }
    this.tacticalRuntimeByAreaId.clear();
    for (const [areaId, runtimeSnapshot] of snapshot.tacticalRuntimeByAreaId) {
      this.tacticalRuntimeByAreaId.set(areaId, runtimeSnapshot);
    }
    this._activeArea = snapshot.activeArea;
  }

  private createStrategicArea(
    area: Extract<CampaignAreaDefinition, { kind: CampaignAreaKind.Strategic }>,
    routePosition: HexCoord = area.initialPartyPosition,
  ): StrategicCampaignArea {
    const mage = this.getPartyMage();
    if (mage.definition.currentHp === 0) {
      throw new Error("A defeated Mage cannot travel on the strategic map");
    }
    return {
      kind: CampaignAreaKind.Strategic,
      definition: area,
      session: new StrategicSession(new GameMap(area.map), routePosition),
      mage,
    };
  }

  private createTacticalArea(
    area: TacticalAreaDefinition,
    entryCoordinate: HexCoord,
    entryDirection: NonNullable<CampaignRouteDefinition["to"]["tacticalEntryDirection"]>,
  ): TacticalCampaignArea {
    const partyMemberIds = [...this.partyMembersById.keys()];
    const partyMembers = partyMemberIds.map((id) => this.getPartyMember(id));
    const baseLevel = area.level;
    const runtimeSnapshot = this.tacticalRuntimeByAreaId.get(area.id);
    const localUnits = runtimeSnapshot?.localUnitDefinitions
      ?? baseLevel.units.filter((unit) => !this.campaignPartyMemberIds.has(unit.id));
    const formation = createTacticalEntryFormation(
      new GameMap(baseLevel.map, baseLevel.structures),
      entryCoordinate,
      entryDirection,
      partyMemberIds,
      localUnits
        .filter((unit) => unit.currentHp !== 0)
        .map((unit) => unit.position),
    );
    const placementByUnitId = new Map(
      formation.map((placement) => [placement.unitId, placement.position]),
    );
    const level = createCampaignTacticalLevel(
      baseLevel,
      partyMembers,
      placementByUnitId,
      localUnits,
    );
    const { session, player } = createGameSession(level);
    if (runtimeSnapshot) {
      session.restoreMageDiscoverySnapshot(runtimeSnapshot.mageDiscovery);
    }

    return {
      kind: CampaignAreaKind.Tactical,
      definition: area,
      session,
      mageId: player.id,
    };
  }

  private captureTacticalParty(area: TacticalCampaignArea): void {
    this.tacticalRuntimeByAreaId.set(area.definition.id, {
      localUnitDefinitions: area.session.units
        .filter((unit) => !this.campaignPartyMemberIds.has(unit.id))
        .map((unit) => ({
          ...getAreaUnitDefinition(area.definition.level, unit.id),
          position: unit.position,
          currentHp: unit.currentHp,
        })),
      mageDiscovery: area.session.getMageDiscoverySnapshot(),
    });

    for (const [memberId, member] of this.partyMembersById) {
      const currentUnit = area.session.getUnit(memberId);
      if (!currentUnit?.isAlive) {
        this.partyMembersById.delete(memberId);
        continue;
      }
      this.partyMembersById.set(memberId, {
        definition: {
          ...cloneUnitDefinition(member.definition),
          position: currentUnit.position,
          currentHp: currentUnit.currentHp,
        },
      });
    }

    if (!this.partyMembersById.has(area.mageId)) {
      throw new Error("A defeated Mage cannot leave a tactical area");
    }
  }

  private getPartyMage(): PersistentPartyMember {
    const mage = this.partyMembersById.get(this.definition.party.mage.id);
    if (!mage) {
      throw new Error("Campaign Mage state is missing");
    }
    return mage;
  }

  private getPartyMember(id: string): PersistentPartyMember {
    const member = this.partyMembersById.get(id);
    if (!member) {
      throw new Error(`Campaign party member ${id} is missing`);
    }
    return member;
  }

  private getTacticalMage(area: TacticalCampaignArea) {
    const mage = area.session.getUnit(area.mageId);
    if (!mage?.isAlive) {
      throw new Error("The tactical campaign Mage is unavailable");
    }
    return mage;
  }
}

function createCampaignTacticalLevel(
  baseLevel: LevelDefinition,
  partyMembers: readonly PersistentPartyMember[],
  placementByUnitId: ReadonlyMap<string, HexCoord>,
  localUnits: readonly UnitDefinition[],
): LevelDefinition {
  const partyDefinitions = partyMembers.map((member) => {
    const position = placementByUnitId.get(member.definition.id);
    if (!position) {
      throw new Error(`Campaign party member ${member.definition.id} has no entry formation position`);
    }
    return {
      ...cloneUnitDefinition(member.definition),
      position: { ...position },
    };
  });
  const mage = partyDefinitions.find((member) => member.id === baseLevel.player.id);
  if (!mage) {
    throw new Error("Campaign party Mage does not match the tactical level Mage");
  }

  return {
    map: baseLevel.map,
    ...(baseLevel.structures === undefined ? {} : { structures: baseLevel.structures }),
    player: mage,
    units: [
      ...partyDefinitions.filter((member) => member.id !== mage.id),
      ...localUnits.map(cloneUnitDefinition),
    ],
  };
}

function clonePartyMember(member: PersistentPartyMember): PersistentPartyMember {
  return {
    definition: cloneUnitDefinition(member.definition),
  };
}

function cloneUnitDefinition(definition: UnitDefinition): UnitDefinition {
  return {
    ...definition,
    position: { ...definition.position },
    attributes: definition.attributes ? { ...definition.attributes } : undefined,
  };
}

function getAreaUnitDefinition(
  level: LevelDefinition,
  unitId: string,
): UnitDefinition {
  const definition = level.player.id === unitId
    ? level.player
    : level.units.find((unit) => unit.id === unitId);
  if (!definition) {
    throw new Error(`Tactical area has no definition for local unit ${unitId}`);
  }
  return cloneUnitDefinition(definition);
}

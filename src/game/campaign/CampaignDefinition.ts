import { isSameHexCoord } from "@/game/board/hexCoord/HexCoord";
import type { LevelDefinition, UnitDefinition } from "@/game/levels/LevelDefinition";
import type { HexCoord, MapArray } from "@/game/types";

export enum CampaignAreaKind {
  Strategic = "strategic",
  Tactical = "tactical",
}

export enum TacticalEntryDirection {
  East = "east",
  NorthEast = "north-east",
  NorthWest = "north-west",
  West = "west",
  SouthWest = "south-west",
  SouthEast = "south-east",
}

export interface CampaignPartyDefinition {
  readonly mage: UnitDefinition;
  readonly servants: readonly UnitDefinition[];
}

interface CampaignAreaDefinitionBase {
  readonly id: string;
  readonly displayName: string;
}

export interface StrategicAreaDefinition extends CampaignAreaDefinitionBase {
  readonly kind: CampaignAreaKind.Strategic;
  readonly map: MapArray;
  readonly initialPartyPosition: HexCoord;
}

export interface TacticalAreaDefinition extends CampaignAreaDefinitionBase {
  readonly kind: CampaignAreaKind.Tactical;
  readonly level: LevelDefinition;
}

export type CampaignAreaDefinition = StrategicAreaDefinition | TacticalAreaDefinition;

export interface CampaignRouteEndpoint {
  readonly areaId: string;
  readonly coordinate: HexCoord;
  /** Required only at a Tactical endpoint to form the entering party. */
  readonly tacticalEntryDirection?: TacticalEntryDirection;
}

/** One directed edge; `reciprocalRouteId` names the reverse edge explicitly. */
export interface CampaignRouteDefinition {
  readonly id: string;
  readonly reciprocalRouteId: string;
  readonly from: CampaignRouteEndpoint;
  readonly to: CampaignRouteEndpoint;
}

export interface CampaignDefinition {
  readonly initialAreaId: string;
  readonly party: CampaignPartyDefinition;
  readonly areas: readonly CampaignAreaDefinition[];
  readonly routes: readonly CampaignRouteDefinition[];
}

/** Validates area identity, endpoint fields, and every authored reverse route. */
export function validateCampaignDefinition(definition: CampaignDefinition): void {
  const areasById = getAreasById(definition.areas);
  if (!areasById.has(definition.initialAreaId)) {
    throw new Error(`Campaign initial area ${definition.initialAreaId} is missing`);
  }

  validateParty(definition.party);

  const routesById = new Map<string, CampaignRouteDefinition>();
  const outboundEndpointKeys = new Set<string>();
  for (const route of definition.routes) {
    if (routesById.has(route.id)) {
      throw new Error(`Campaign route ${route.id} is defined more than once`);
    }
    validateRouteEndpoint(route.from, areasById, route.id, "from");
    validateRouteEndpoint(route.to, areasById, route.id, "to");
    const outboundEndpointKey = `${route.from.areaId}:${route.from.coordinate.q},${route.from.coordinate.r}`;
    if (outboundEndpointKeys.has(outboundEndpointKey)) {
      throw new Error(`Campaign route endpoint ${outboundEndpointKey} is ambiguous`);
    }
    outboundEndpointKeys.add(outboundEndpointKey);
    routesById.set(route.id, route);
  }

  for (const route of definition.routes) {
    const reciprocalRoute = routesById.get(route.reciprocalRouteId);
    if (!reciprocalRoute) {
      throw new Error(`Campaign route ${route.id} has no reciprocal route`);
    }
    if (reciprocalRoute.reciprocalRouteId !== route.id
      || !areSameRouteEndpoints(route.from, reciprocalRoute.to)
      || !areSameRouteEndpoints(route.to, reciprocalRoute.from)) {
      throw new Error(`Campaign route ${route.id} is not reciprocal`);
    }
  }
}

export function getCampaignArea(
  definition: CampaignDefinition,
  areaId: string,
): CampaignAreaDefinition {
  const area = definition.areas.find((candidate) => candidate.id === areaId);
  if (!area) {
    throw new Error(`Campaign area ${areaId} is missing`);
  }
  return area;
}

function getAreasById(
  areas: readonly CampaignAreaDefinition[],
): ReadonlyMap<string, CampaignAreaDefinition> {
  const areasById = new Map<string, CampaignAreaDefinition>();
  for (const area of areas) {
    if (areasById.has(area.id)) {
      throw new Error(`Campaign area ${area.id} is defined more than once`);
    }
    areasById.set(area.id, area);
  }
  return areasById;
}

function validateParty(party: CampaignPartyDefinition): void {
  const partyMemberIds = new Set<string>();
  for (const member of [party.mage, ...party.servants]) {
    if (partyMemberIds.has(member.id)) {
      throw new Error(`Campaign party member ${member.id} is defined more than once`);
    }
    partyMemberIds.add(member.id);
  }
}

function validateRouteEndpoint(
  endpoint: CampaignRouteEndpoint,
  areasById: ReadonlyMap<string, CampaignAreaDefinition>,
  routeId: string,
  endpointName: string,
): void {
  const area = areasById.get(endpoint.areaId);
  if (!area) {
    throw new Error(`Campaign route ${routeId} ${endpointName} area ${endpoint.areaId} is missing`);
  }

  const map = area.kind === CampaignAreaKind.Strategic ? area.map : area.level.map;
  if (!map.some((field) => isSameHexCoord(field, endpoint.coordinate))) {
    throw new Error(`Campaign route ${routeId} ${endpointName} coordinate is outside ${area.id}`);
  }
  if (area.kind === CampaignAreaKind.Tactical && !endpoint.tacticalEntryDirection) {
    throw new Error(`Campaign route ${routeId} ${endpointName} tactical entry direction is required`);
  }
  if (area.kind === CampaignAreaKind.Strategic && endpoint.tacticalEntryDirection) {
    throw new Error(`Campaign route ${routeId} ${endpointName} strategic endpoint cannot have a tactical entry direction`);
  }
}

function areSameRouteEndpoints(
  first: CampaignRouteEndpoint,
  second: CampaignRouteEndpoint,
): boolean {
  return first.areaId === second.areaId
    && isSameHexCoord(first.coordinate, second.coordinate)
    && first.tacticalEntryDirection === second.tacticalEntryDirection;
}

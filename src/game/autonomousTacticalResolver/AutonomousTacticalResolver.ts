import { GameMap, type MovementPath } from "@/game/board/gameMap/GameMap";
import {
  compareHexCoords,
  getHexCoordKey,
  isSameHexCoord,
} from "@/game/board/hexCoord/HexCoord";
import {
  Faction,
  FactionDisposition,
  getFactionDisposition,
} from "@/game/faction/Faction";
import {
  TacticalActionPointCost,
  TimelineAction,
} from "@/game/eventTimeline/EventTimeline";
import {
  protectMageThreatRange,
  ServantStrategyType,
  type ServantStrategy,
} from "@/game/unit/servantStrategy/ServantStrategy";
import { UnitTacticalRole } from "@/game/unit/Unit";
import { MovementType, type HexCoord } from "@/game/types";
import {
  hasElevationLineOfSight,
  type IsSightLineBlocked,
} from "@/game/visibility/ElevationLineOfSight";

const adjacentHexDistance = 1;

/** Immutable decision input, copied from GameSession's authoritative state. */
export interface AutonomousUnitSnapshot {
  readonly id: string;
  readonly faction: Faction;
  readonly movementType: MovementType;
  readonly tacticalRole: UnitTacticalRole;
  readonly viewRange: number;
  readonly isAlive: boolean;
  readonly position: HexCoord;
}

export interface EnemyMemorySnapshot {
  readonly lastKnownHostilePosition: HexCoord | undefined;
}

export interface ServantMemorySnapshot {
  readonly defaultTargetId: string | undefined;
}

/** All resolver reads are explicit; mutation remains in GameSession. */
export interface AutonomousTacticalResolverInput {
  readonly gameMap: GameMap;
  /** Preserves level registration order for target tie breaking. */
  readonly units: readonly AutonomousUnitSnapshot[];
  /** O(1) identity lookup for memory and standing-order targets. */
  readonly unitsById: ReadonlyMap<string, AutonomousUnitSnapshot>;
  /** O(1) living occupancy lookup for autonomous pathfinding. */
  readonly livingUnitIdByHex: ReadonlyMap<string, string>;
  /** Session-owned blockers such as closed DoorBlocks. */
  readonly isGroundEntryBlocked?: (coord: HexCoord) => boolean;
  /** Session-owned sight blockers such as closed DoorBlocks. */
  readonly isSightLineBlocked?: IsSightLineBlocked;
  readonly actorId: string;
  readonly mageId: string;
  readonly remainingActionPoints: number;
  readonly enemyMemory: EnemyMemorySnapshot;
  readonly servantMemory: ServantMemorySnapshot;
  readonly servantStrategy: ServantStrategy | undefined;
}

export enum AutonomousMemoryDirectiveType {
  RememberEnemyHostile = "remember-enemy-hostile",
  ClearEnemyMemory = "clear-enemy-memory",
  RememberServantDefaultTarget = "remember-servant-default-target",
  ClearServantDefaultTarget = "clear-servant-default-target",
}

export type AutonomousMemoryDirective =
  | {
    readonly type: AutonomousMemoryDirectiveType.RememberEnemyHostile;
    readonly hostileId: string;
    readonly position: HexCoord;
  }
  | { readonly type: AutonomousMemoryDirectiveType.ClearEnemyMemory }
  | {
    readonly type: AutonomousMemoryDirectiveType.RememberServantDefaultTarget;
    readonly targetId: string;
  }
  | { readonly type: AutonomousMemoryDirectiveType.ClearServantDefaultTarget };

interface AutonomousDecisionBase {
  readonly memoryDirectives: readonly AutonomousMemoryDirective[];
  /** GameSession applies this only after it accepts the resolved decision. */
  readonly clearServantStrategy: boolean;
}

export type AutonomousTacticalDecision =
  | (AutonomousDecisionBase & { readonly action: TimelineAction.Wait })
  | (AutonomousDecisionBase & {
    readonly action: TimelineAction.Attack;
    readonly targetId: string;
  })
  | (AutonomousDecisionBase & {
    readonly action: TimelineAction.Move;
    readonly destination: HexCoord;
    /** Exact cost from GameMap for this one legal movement edge. */
    readonly actionPointCost: number;
  });

/**
 * Computes exactly one autonomous tactical intent. It never mutates Units,
 * GameMap, occupancy, timeline state, memory, or standing orders. The caller
 * owns validation and application of the returned intent.
 */
export function resolveAutonomousTacticalDecision(
  input: AutonomousTacticalResolverInput,
): AutonomousTacticalDecision {
  const actor = getUnit(input, input.actorId);
  if (!actor || !actor.isAlive) {
    return waitDecision();
  }

  if (actor.faction === Faction.Enemy) {
    return resolveEnemyDecision(input, actor);
  }

  if (!isPlayerFactionServant(actor, input.mageId)) {
    return waitDecision();
  }

  const strategy = input.servantStrategy;
  if (!strategy) {
    return resolveDefaultServantEngagement(input, actor);
  }

  switch (strategy.type) {
    case ServantStrategyType.Hold:
      return resolveHoldServantStrategy(input, actor);
    case ServantStrategyType.PursueDesignatedEnemy:
      return resolvePursueDesignatedEnemy(input, actor, strategy);
    case ServantStrategyType.SecureDesignatedHex:
      return resolveSecureDesignatedHex(input, actor, strategy);
    case ServantStrategyType.ProtectMage:
      return resolveProtectMage(input, actor);
  }
}

function resolveDefaultServantEngagement(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
): AutonomousTacticalDecision {
  const directives: AutonomousMemoryDirective[] = [];
  const rememberedTargetId = input.servantMemory.defaultTargetId;
  const rememberedTarget = rememberedTargetId
    ? getUnit(input, rememberedTargetId)
    : undefined;
  if (rememberedTarget && isPerceivedHostile(input, servant, rememberedTarget)) {
    return resolveServantEngagementTarget(input, servant, rememberedTarget, directives);
  }

  if (rememberedTargetId) {
    directives.push({ type: AutonomousMemoryDirectiveType.ClearServantDefaultTarget });
  }

  const firstPerceivedHostile = findFirstPerceivedHostile(
    input,
    servant,
    servant.viewRange,
  );
  if (!firstPerceivedHostile) {
    return resolveUnorderedServantFollowMage(input, servant, directives);
  }

  directives.push({
    type: AutonomousMemoryDirectiveType.RememberServantDefaultTarget,
    targetId: firstPerceivedHostile.id,
  });
  return resolveServantEngagementTarget(
    input,
    servant,
    firstPerceivedHostile,
    directives,
  );
}

/** An unordered servant stays near its Mage only when it perceives no hostile. */
function resolveUnorderedServantFollowMage(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
  memoryDirectives: readonly AutonomousMemoryDirective[],
): AutonomousTacticalDecision {
  const mage = getUnit(input, input.mageId);
  if (!mage
    || !mage.isAlive
    || mage.tacticalRole !== UnitTacticalRole.Mage
    || input.gameMap.getHexDistance(servant.position, mage.position)
      <= adjacentHexDistance) {
    return waitDecision(memoryDirectives);
  }

  return moveServantTowardHex(input, servant, mage.position, memoryDirectives);
}

function resolveHoldServantStrategy(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
): AutonomousTacticalDecision {
  const adjacentHostile = findFirstPerceivedHostile(
    input,
    servant,
    adjacentHexDistance,
  );
  return adjacentHostile && canAffordAction(
    input.remainingActionPoints,
    TacticalActionPointCost.Attack,
  )
    ? attackDecision(adjacentHostile.id)
    : waitDecision();
}

function resolveProtectMage(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
): AutonomousTacticalDecision {
  const mage = getUnit(input, input.mageId);
  if (!mage || !mage.isAlive || mage.tacticalRole !== UnitTacticalRole.Mage) {
    return withClearServantStrategy(resolveDefaultServantEngagement(input, servant));
  }

  const adjacentThreat = findNearestProtectMageThreat(
    input,
    servant,
    mage,
    (threat) => input.gameMap.getHexDistance(servant.position, threat.position)
      === adjacentHexDistance,
  );
  if (adjacentThreat) {
    return canAffordAction(input.remainingActionPoints, TacticalActionPointCost.Attack)
      ? attackDecision(adjacentThreat.id)
      : waitDecision();
  }

  const perceivedThreat = findNearestProtectMageThreat(input, servant, mage);
  if (perceivedThreat) {
    const threatApproach = findProtectMageThreatApproach(input, servant, mage);
    return threatApproach && threatApproach.steps.length > 0
      ? resolveAutonomousMovement(input, servant, threatApproach.steps[0])
      : waitDecision();
  }

  return moveServantTowardHex(input, servant, mage.position);
}

function resolvePursueDesignatedEnemy(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
  strategy: Extract<
    ServantStrategy,
    { type: ServantStrategyType.PursueDesignatedEnemy }
  >,
): AutonomousTacticalDecision {
  const target = getUnit(input, strategy.targetEnemyId);
  if (!target
    || !target.isAlive
    || target.faction !== Faction.Enemy
    || getFactionDisposition(servant.faction, target.faction)
      !== FactionDisposition.Enemy) {
    return waitDecision([], true);
  }

  return resolveServantEngagementTarget(input, servant, target);
}

function resolveServantEngagementTarget(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
  target: AutonomousUnitSnapshot,
  memoryDirectives: readonly AutonomousMemoryDirective[] = [],
): AutonomousTacticalDecision {
  if (input.gameMap.getHexDistance(servant.position, target.position)
    === adjacentHexDistance) {
    return canAffordAction(input.remainingActionPoints, TacticalActionPointCost.Attack)
      ? attackDecision(target.id, memoryDirectives)
      : waitDecision(memoryDirectives);
  }

  const path = findShortestApproachPath(input, servant, target.position);
  return path && path.steps.length > 0
    ? resolveAutonomousMovement(input, servant, path.steps[0], memoryDirectives)
    : waitDecision(memoryDirectives);
}

function resolveSecureDesignatedHex(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
  strategy: Extract<
    ServantStrategy,
    { type: ServantStrategyType.SecureDesignatedHex }
  >,
): AutonomousTacticalDecision {
  if (!input.gameMap.getField(strategy.targetHex.q, strategy.targetHex.r)) {
    return waitDecision([], true);
  }

  if (isSameHexCoord(servant.position, strategy.targetHex)) {
    return resolveHoldServantStrategy(input, servant);
  }

  const targetOccupant = getLivingUnitAt(input, strategy.targetHex);
  if (targetOccupant) {
    if (getFactionDisposition(servant.faction, targetOccupant.faction)
      === FactionDisposition.Enemy
      && input.gameMap.getHexDistance(servant.position, targetOccupant.position)
        === adjacentHexDistance) {
      return canAffordAction(input.remainingActionPoints, TacticalActionPointCost.Attack)
        ? attackDecision(targetOccupant.id)
        : waitDecision();
    }

    return moveServantTowardHex(input, servant, strategy.targetHex);
  }

  const path = input.gameMap.findShortestPathToAny(
    servant.position,
    servant.movementType,
    (coord) => isSameHexCoord(coord, strategy.targetHex),
    (coord) => getLivingUnitAt(input, coord) !== undefined,
  );
  return path && path.steps.length > 0
    ? resolveAutonomousMovement(input, servant, path.steps[0])
    : waitDecision();
}

function resolveEnemyDecision(
  input: AutonomousTacticalResolverInput,
  enemy: AutonomousUnitSnapshot,
): AutonomousTacticalDecision {
  const visibleHostile = findNearestVisibleHostile(input, enemy);
  if (visibleHostile) {
    const memoryDirectives: readonly AutonomousMemoryDirective[] = [{
      type: AutonomousMemoryDirectiveType.RememberEnemyHostile,
      hostileId: visibleHostile.id,
      position: { ...visibleHostile.position },
    }];
    if (input.gameMap.getHexDistance(enemy.position, visibleHostile.position)
      === adjacentHexDistance) {
      return canAffordAction(input.remainingActionPoints, TacticalActionPointCost.Attack)
        ? attackDecision(visibleHostile.id, memoryDirectives)
        : waitDecision(memoryDirectives);
    }

    return moveEnemyToward(input, enemy, visibleHostile.position, memoryDirectives);
  }

  const lastKnownHostilePosition = input.enemyMemory.lastKnownHostilePosition;
  if (!lastKnownHostilePosition) {
    return waitDecision();
  }

  if (isSameHexCoord(enemy.position, lastKnownHostilePosition)) {
    return waitDecision([
      { type: AutonomousMemoryDirectiveType.ClearEnemyMemory },
    ]);
  }

  return moveEnemyToward(input, enemy, lastKnownHostilePosition);
}

function findNearestProtectMageThreat(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
  mage: AutonomousUnitSnapshot,
  predicate: (threat: AutonomousUnitSnapshot) => boolean = () => true,
): AutonomousUnitSnapshot | undefined {
  let nearestThreat: AutonomousUnitSnapshot | undefined;
  let nearestMageDistance = Number.POSITIVE_INFINITY;

  for (const candidate of input.units) {
    const mageDistance = input.gameMap.getHexDistance(mage.position, candidate.position);
    if (mageDistance > protectMageThreatRange
      || mageDistance >= nearestMageDistance
      || !predicate(candidate)
      || !isPerceivedHostile(input, servant, candidate)) {
      continue;
    }

    nearestThreat = candidate;
    nearestMageDistance = mageDistance;
  }

  return nearestThreat;
}

function findProtectMageThreatApproach(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
  mage: AutonomousUnitSnapshot,
): MovementPath | undefined {
  let shortestPath: MovementPath | undefined;

  for (const candidate of input.units) {
    if (input.gameMap.getHexDistance(mage.position, candidate.position)
      > protectMageThreatRange
      || !isPerceivedHostile(input, servant, candidate)) {
      continue;
    }

    const path = findShortestApproachPath(input, servant, candidate.position);
    if (!path || path.steps.length === 0
      || (shortestPath !== undefined && path.cost >= shortestPath.cost)) {
      continue;
    }

    shortestPath = path;
  }

  return shortestPath;
}

function findNearestVisibleHostile(
  input: AutonomousTacticalResolverInput,
  enemy: AutonomousUnitSnapshot,
): AutonomousUnitSnapshot | undefined {
  let nearestHostile: AutonomousUnitSnapshot | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of input.units) {
    const distance = input.gameMap.getHexDistance(enemy.position, candidate.position);
    if (!isPerceivedHostile(input, enemy, candidate)
      || distance >= nearestDistance) {
      continue;
    }

    nearestHostile = candidate;
    nearestDistance = distance;
  }

  return nearestHostile;
}

function findFirstPerceivedHostile(
  input: AutonomousTacticalResolverInput,
  observer: AutonomousUnitSnapshot,
  maximumDistance: number,
): AutonomousUnitSnapshot | undefined {
  for (const candidate of input.units) {
    if (isPerceivedHostile(input, observer, candidate)
      && input.gameMap.getHexDistance(observer.position, candidate.position)
        <= maximumDistance) {
      return candidate;
    }
  }

  return undefined;
}

function isPerceivedHostile(
  input: AutonomousTacticalResolverInput,
  observer: AutonomousUnitSnapshot,
  candidate: AutonomousUnitSnapshot,
): boolean {
  return candidate.isAlive
    && getFactionDisposition(observer.faction, candidate.faction)
      === FactionDisposition.Enemy
    && input.gameMap.getHexDistance(observer.position, candidate.position)
      <= observer.viewRange
    && hasElevationLineOfSight(
      input.gameMap,
      observer.position,
      candidate.position,
      input.isSightLineBlocked,
    );
}

function moveEnemyToward(
  input: AutonomousTacticalResolverInput,
  enemy: AutonomousUnitSnapshot,
  destination: HexCoord,
  memoryDirectives: readonly AutonomousMemoryDirective[] = [],
): AutonomousTacticalDecision {
  const currentDistance = input.gameMap.getHexDistance(enemy.position, destination);
  const candidate = input.gameMap.getNeighbours(enemy.position)
    .map((coord) => ({
      coord,
      traversalCost: input.gameMap.getTraversalCost(
        enemy.position,
        coord,
        enemy.movementType,
      ),
    }))
    .filter((entry) => entry.traversalCost !== undefined)
    .filter((entry) => !isGroundEntryBlocked(input, enemy, entry.coord))
    .filter((entry) => getLivingUnitAt(input, entry.coord) === undefined)
    .filter((entry) => input.gameMap.getHexDistance(entry.coord, destination)
      < currentDistance)
    .filter((entry) => canAffordAction(
      input.remainingActionPoints,
      entry.traversalCost!,
    ))
    .sort((first, second) => first.traversalCost! - second.traversalCost!
      || compareHexCoords(first.coord, second.coord))[0];

  return candidate
    ? resolveAutonomousMovement(input, enemy, candidate.coord, memoryDirectives)
    : waitDecision(memoryDirectives);
}

function findShortestApproachPath(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
  targetHex: HexCoord,
): MovementPath | undefined {
  const approachHexKeys = new Set<string>();
  for (const coord of input.gameMap.getNeighbours(targetHex)) {
    if (canUnitOccupy(input, servant, coord)) {
      approachHexKeys.add(getHexCoordKey(coord));
    }
  }

  if (approachHexKeys.size === 0) {
    return undefined;
  }

  return input.gameMap.findShortestPathToAny(
    servant.position,
    servant.movementType,
    (coord) => approachHexKeys.has(getHexCoordKey(coord)),
    (coord) => getLivingUnitAt(input, coord) !== undefined
      || isGroundEntryBlocked(input, servant, coord),
  );
}

function moveServantTowardHex(
  input: AutonomousTacticalResolverInput,
  servant: AutonomousUnitSnapshot,
  targetHex: HexCoord,
  memoryDirectives: readonly AutonomousMemoryDirective[] = [],
): AutonomousTacticalDecision {
  const path = findShortestApproachPath(input, servant, targetHex);
  return path && path.steps.length > 0
    ? resolveAutonomousMovement(input, servant, path.steps[0], memoryDirectives)
    : waitDecision(memoryDirectives);
}

function canUnitOccupy(
  input: AutonomousTacticalResolverInput,
  unit: AutonomousUnitSnapshot,
  coord: HexCoord,
): boolean {
  const field = input.gameMap.getField(coord.q, coord.r);
  return field !== undefined
    && field.getAllowedMovements()[unit.movementType]
    && !isGroundEntryBlocked(input, unit, coord)
    && getLivingUnitAt(input, coord) === undefined;
}

function resolveAutonomousMovement(
  input: AutonomousTacticalResolverInput,
  unit: AutonomousUnitSnapshot,
  destination: HexCoord,
  memoryDirectives: readonly AutonomousMemoryDirective[] = [],
): AutonomousTacticalDecision {
  const traversalCost = input.gameMap.getTraversalCost(
    unit.position,
    destination,
    unit.movementType,
  );
  if (traversalCost === undefined
    || isGroundEntryBlocked(input, unit, destination)
    || !canAffordAction(input.remainingActionPoints, traversalCost)) {
    return waitDecision(memoryDirectives);
  }

  return moveDecision(destination, traversalCost, memoryDirectives);
}

function isGroundEntryBlocked(
  input: AutonomousTacticalResolverInput,
  unit: AutonomousUnitSnapshot,
  coord: HexCoord,
): boolean {
  return unit.movementType === MovementType.Ground
    && (input.isGroundEntryBlocked?.(coord) ?? false);
}

function getUnit(
  input: AutonomousTacticalResolverInput,
  unitId: string,
): AutonomousUnitSnapshot | undefined {
  return input.unitsById.get(unitId);
}

function getLivingUnitAt(
  input: AutonomousTacticalResolverInput,
  coord: HexCoord,
): AutonomousUnitSnapshot | undefined {
  const unitId = input.livingUnitIdByHex.get(getHexCoordKey(coord));
  return unitId ? input.unitsById.get(unitId) : undefined;
}

function isPlayerFactionServant(
  unit: AutonomousUnitSnapshot,
  mageId: string,
): boolean {
  return unit.isAlive && unit.faction === Faction.Player && unit.id !== mageId;
}

function canAffordAction(remainingActionPoints: number, actionPointCost: number): boolean {
  return remainingActionPoints >= actionPointCost;
}

function waitDecision(
  memoryDirectives: readonly AutonomousMemoryDirective[] = [],
  clearServantStrategy: boolean = false,
): AutonomousTacticalDecision {
  return { action: TimelineAction.Wait, memoryDirectives, clearServantStrategy };
}

function attackDecision(
  targetId: string,
  memoryDirectives: readonly AutonomousMemoryDirective[] = [],
): AutonomousTacticalDecision {
  return {
    action: TimelineAction.Attack,
    targetId,
    memoryDirectives,
    clearServantStrategy: false,
  };
}

function moveDecision(
  destination: HexCoord,
  actionPointCost: number,
  memoryDirectives: readonly AutonomousMemoryDirective[] = [],
): AutonomousTacticalDecision {
  return {
    action: TimelineAction.Move,
    destination: { ...destination },
    actionPointCost,
    memoryDirectives,
    clearServantStrategy: false,
  };
}

function withClearServantStrategy(
  decision: AutonomousTacticalDecision,
): AutonomousTacticalDecision {
  return { ...decision, clearServantStrategy: true };
}

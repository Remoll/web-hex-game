import { Field } from "@/game/board/field/Field";
import {
  getHexCoordKey,
  getHexDistance,
} from "@/game/board/hexCoord/HexCoord";
import {
  baseMovementActionPointCost,
  calculateGroundTraversalActionPointCost,
  maximumGroundElevationDifference,
} from "@/game/movement/GroundMovementRules";
import {
  type FieldsMap,
  type HexCoord,
  type MapArray,
  MovementType,
  type Q,
  type R,
} from "@/game/types";

const axialNeighbourOffsets: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const originMovementPathCost = 0;
const originMovementPathSteps = 0;
const adjacentHexDistance = 1;
const firstArrayIndex = 0;
const discoveryOrderIncrement = 1;

export interface MovementPath {
  /** Destination-only steps: the origin is intentionally excluded. */
  readonly steps: readonly HexCoord[];
  readonly cost: number;
}

export type IsHexBlocked = (coord: HexCoord) => boolean;
export type IsDestinationHex = (coord: HexCoord) => boolean;

interface WeightedPathNode {
  readonly coord: HexCoord;
  readonly cost: number;
  readonly stepCount: number;
  readonly parent: WeightedPathNode | undefined;
  /** Fixed discovery order preserves the axial-neighbour tie-breaker. */
  readonly discoveryOrder: number;
}

interface WeightedPathSearchResult {
  readonly bestNodesByCoordKey: ReadonlyMap<string, WeightedPathNode>;
  readonly destinationNode: WeightedPathNode | undefined;
}

export class GameMap {
  private readonly fieldsMap: FieldsMap = new Map();
  private readonly _radiusInHex;

  constructor(mapArray: MapArray) {
    mapArray.forEach(({ q, r, fieldAttrs }) => {
      if (!this.fieldsMap.has(q)) {
        this.fieldsMap.set(q, new Map());
      }

      const column = this.fieldsMap.get(q)!;
      if (column.has(r)) {
        throw new Error(`The map contains duplicate field coordinates at ${q},${r}`);
      }

      column.set(r, new Field(fieldAttrs));
    });

    this._radiusInHex = this.getRadiusInHex();
  }

  forEachField(callback: (q: Q, r: R, field: Field) => void) {
    for (const [q, col] of this.fieldsMap) {
      for (const [r, field] of col) {
        callback(q, r, field);
      }
    }
  }

  getField(q: Q, r: R): Field | undefined {
    return this.fieldsMap.get(q)?.get(r);
  }

  getNeighbours(coord: HexCoord): readonly HexCoord[] {
    return axialNeighbourOffsets
      .map(({ q, r }) => ({ q: coord.q + q, r: coord.r + r }))
      .filter(({ q, r }) => this.getField(q, r) !== undefined);
  }

  getHexDistance(first: HexCoord, second: HexCoord): number {
    return getHexDistance(first, second);
  }

  /**
   * Returns the AP cost of traversing one adjacent edge, or undefined when the
   * edge is illegal for the movement type or target field.
   */
  getTraversalCost(
    origin: HexCoord,
    destination: HexCoord,
    movementType: MovementType,
  ): number | undefined {
    const originField = this.getField(origin.q, origin.r);
    const destinationField = this.getField(destination.q, destination.r);
    if (!originField
      || !destinationField
      || this.getHexDistance(origin, destination) !== adjacentHexDistance
      || !destinationField.getAllowedMovements()[movementType]) {
      return undefined;
    }

    if (movementType !== MovementType.Ground) {
      return baseMovementActionPointCost;
    }

    const elevationDifference = destinationField.getGroundLevel()
      - originField.getGroundLevel();
    if (Math.abs(elevationDifference) > maximumGroundElevationDifference) {
      return undefined;
    }

    return calculateGroundTraversalActionPointCost(
      originField.getLeavingCostMultiplier(),
      elevationDifference,
    );
  }

  /**
   * Finds every cheapest legal path within AP and optional hex-step budgets.
   * Equal-cost routes keep the fixed axial-neighbour discovery order.
   */
  getReachablePaths(
    origin: HexCoord,
    movementType: MovementType,
    maxCost: number,
    isBlocked: IsHexBlocked = () => false,
    maxStepCount: number = maxCost,
  ): ReadonlyMap<string, MovementPath> {
    if (!Number.isInteger(maxCost)
      || maxCost < originMovementPathCost
      || !Number.isInteger(maxStepCount)
      || maxStepCount < originMovementPathSteps
      || !this.hasField(origin)) {
      return new Map();
    }

    const { bestNodesByCoordKey } = this.findWeightedPaths(
      origin,
      movementType,
      isBlocked,
      maxCost,
      maxStepCount,
    );
    const paths = new Map<string, MovementPath>();
    for (const [coordKey, node] of bestNodesByCoordKey) {
      if (coordKey !== getHexCoordKey(origin)) {
        paths.set(coordKey, buildMovementPath(node));
      }
    }
    return paths;
  }

  findShortestPath(
    origin: HexCoord,
    destination: HexCoord,
    movementType: MovementType,
    maxCost: number,
    isBlocked: IsHexBlocked = () => false,
    maxStepCount: number = maxCost,
  ): MovementPath | undefined {
    return this.getReachablePaths(
      origin,
      movementType,
      maxCost,
      isBlocked,
      maxStepCount,
    ).get(getHexCoordKey(destination));
  }

  /** Finds one cheapest deterministic path for autonomous resolution. */
  findShortestPathToAny(
    origin: HexCoord,
    movementType: MovementType,
    isDestination: IsDestinationHex,
    isBlocked: IsHexBlocked = () => false,
  ): MovementPath | undefined {
    if (!this.hasField(origin)) {
      return undefined;
    }

    const { destinationNode } = this.findWeightedPaths(
      origin,
      movementType,
      isBlocked,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      isDestination,
    );
    return destinationNode ? buildMovementPath(destinationNode) : undefined;
  }

  get radiusInHex(): number {
    return this._radiusInHex;
  }

  private getRadiusInHex(): number {
    let radius = 0;

    this.forEachField((q, r) => {
      radius = Math.max(radius, Math.abs(q), Math.abs(r), Math.abs(q + r));
    });

    return radius;
  }

  private hasField(coord: HexCoord): boolean {
    return this.getField(coord.q, coord.r) !== undefined;
  }

  private findWeightedPaths(
    origin: HexCoord,
    movementType: MovementType,
    isBlocked: IsHexBlocked,
    maxCost: number,
    maxStepCount: number,
    isDestination?: IsDestinationHex,
  ): WeightedPathSearchResult {
    let nextDiscoveryOrder = originMovementPathSteps;
    const originNode: WeightedPathNode = {
      coord: { ...origin },
      cost: originMovementPathCost,
      stepCount: originMovementPathSteps,
      parent: undefined,
      discoveryOrder: nextDiscoveryOrder,
    };
    const bestNodesByCoordKey = new Map<string, WeightedPathNode>([
      [getHexCoordKey(origin), originNode],
    ]);
    const pendingNodes: WeightedPathNode[] = [originNode];
    nextDiscoveryOrder += discoveryOrderIncrement;

    while (pendingNodes.length > 0) {
      const current = takeLowestCostNode(pendingNodes);
      if (bestNodesByCoordKey.get(getHexCoordKey(current.coord)) !== current) {
        continue;
      }

      if (isDestination?.(current.coord)) {
        return { bestNodesByCoordKey, destinationNode: current };
      }

      if (current.cost >= maxCost || current.stepCount >= maxStepCount) {
        continue;
      }

      for (const neighbour of this.getNeighbours(current.coord)) {
        if (isBlocked(neighbour)) {
          continue;
        }

        const traversalCost = this.getTraversalCost(
          current.coord,
          neighbour,
          movementType,
        );
        if (traversalCost === undefined) {
          continue;
        }

        const cost = current.cost + traversalCost;
        const stepCount = current.stepCount + discoveryOrderIncrement;
        if (cost > maxCost || stepCount > maxStepCount) {
          continue;
        }

        const coordKey = getHexCoordKey(neighbour);
        const existingNode = bestNodesByCoordKey.get(coordKey);
        if (existingNode
          && (existingNode.cost < cost
            || (existingNode.cost === cost
              && existingNode.stepCount <= stepCount))) {
          continue;
        }

        const node: WeightedPathNode = {
          coord: { ...neighbour },
          cost,
          stepCount,
          parent: current,
          discoveryOrder: nextDiscoveryOrder,
        };
        nextDiscoveryOrder += discoveryOrderIncrement;
        bestNodesByCoordKey.set(coordKey, node);
        pendingNodes.push(node);
      }
    }

    return { bestNodesByCoordKey, destinationNode: undefined };
  }
}

function takeLowestCostNode(nodes: WeightedPathNode[]): WeightedPathNode {
  let lowestIndex = firstArrayIndex;
  for (let index = discoveryOrderIncrement; index < nodes.length; index += 1) {
    if (compareWeightedPathNodes(nodes[index], nodes[lowestIndex]) < 0) {
      lowestIndex = index;
    }
  }

  const [lowest] = nodes.splice(lowestIndex, discoveryOrderIncrement);
  return lowest;
}

function compareWeightedPathNodes(
  first: WeightedPathNode,
  second: WeightedPathNode,
): number {
  return first.cost - second.cost
    || first.stepCount - second.stepCount
    || first.discoveryOrder - second.discoveryOrder;
}

function buildMovementPath(destination: WeightedPathNode): MovementPath {
  const reversedSteps: HexCoord[] = [];
  let current: WeightedPathNode | undefined = destination;

  while (current?.parent) {
    reversedSteps.push({ ...current.coord });
    current = current.parent;
  }

  const steps = reversedSteps.reverse();
  return { steps, cost: destination.cost };
}

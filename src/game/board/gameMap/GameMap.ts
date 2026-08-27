import { Field } from "@/game/board/field/Field";
import {
  type FieldsMap,
  type HexCoord,
  type MapArray,
  type MovementType,
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

export interface MovementPath {
  /** Destination-only steps: the origin is intentionally excluded. */
  readonly steps: readonly HexCoord[];
  readonly cost: number;
}

export type IsHexBlocked = (coord: HexCoord) => boolean;
export type IsDestinationHex = (coord: HexCoord) => boolean;

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
    return Math.max(
      Math.abs(first.q - second.q),
      Math.abs(first.r - second.r),
      Math.abs(first.q + first.r - second.q - second.r),
    );
  }

  /**
   * Finds every shortest, passable path up to a movement budget. Each entered
   * hex costs one; terrain cost and elevation are intentionally not considered.
   */
  getReachablePaths(
    origin: HexCoord,
    movementType: MovementType,
    maxCost: number,
    isBlocked: IsHexBlocked = () => false,
  ): ReadonlyMap<string, MovementPath> {
    if (!Number.isInteger(maxCost) || maxCost < 0 || !this.hasField(origin)) {
      return new Map();
    }

    const originKey = getCoordKey(origin);
    const paths = new Map<string, MovementPath>([
      [originKey, { steps: [], cost: 0 }],
    ]);
    const queue: HexCoord[] = [{ ...origin }];

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      const currentPath = paths.get(getCoordKey(current));
      if (!currentPath || currentPath.cost >= maxCost) {
        continue;
      }

      for (const neighbour of this.getNeighbours(current)) {
        const key = getCoordKey(neighbour);
        const field = this.getField(neighbour.q, neighbour.r);
        if (!field
          || paths.has(key)
          || isBlocked(neighbour)
          || !field.getAllowedMovements()[movementType]) {
          continue;
        }

        paths.set(key, {
          steps: [...currentPath.steps, { ...neighbour }],
          cost: currentPath.cost + 1,
        });
        queue.push(neighbour);
      }
    }

    paths.delete(originKey);
    return paths;
  }

  findShortestPath(
    origin: HexCoord,
    destination: HexCoord,
    movementType: MovementType,
    maxCost: number,
    isBlocked: IsHexBlocked = () => false,
  ): MovementPath | undefined {
    return this.getReachablePaths(
      origin,
      movementType,
      maxCost,
      isBlocked,
    ).get(getCoordKey(destination));
  }

  /**
   * Finds one deterministic shortest path without allocating a path array for
   * every visited field. Equal paths use the fixed axial neighbour order.
   * Autonomous strategies use it only on an activation, never from the render
   * loop.
   */
  findShortestPathToAny(
    origin: HexCoord,
    movementType: MovementType,
    isDestination: IsDestinationHex,
    isBlocked: IsHexBlocked = () => false,
  ): MovementPath | undefined {
    if (!this.hasField(origin)) {
      return undefined;
    }

    if (isDestination(origin)) {
      return { steps: [], cost: originMovementPathCost };
    }

    const originKey = getCoordKey(origin);
    const parentByKey = new Map<string, HexCoord | undefined>([
      [originKey, undefined],
    ]);
    const queue: HexCoord[] = [{ ...origin }];

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const neighbour of this.getNeighbours(current)) {
        const key = getCoordKey(neighbour);
        const field = this.getField(neighbour.q, neighbour.r);
        if (!field
          || parentByKey.has(key)
          || isBlocked(neighbour)
          || !field.getAllowedMovements()[movementType]) {
          continue;
        }

        parentByKey.set(key, current);
        if (isDestination(neighbour)) {
          return buildPathFromParents(neighbour, origin, parentByKey);
        }

        queue.push(neighbour);
      }
    }

    return undefined;
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
}

function getCoordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function buildPathFromParents(
  destination: HexCoord,
  origin: HexCoord,
  parentByKey: ReadonlyMap<string, HexCoord | undefined>,
): MovementPath {
  const reversedSteps: HexCoord[] = [];
  let current = destination;

  while (getCoordKey(current) !== getCoordKey(origin)) {
    reversedSteps.push({ ...current });
    const parent = parentByKey.get(getCoordKey(current));
    if (!parent) {
      throw new Error("Path destination is missing a parent coordinate");
    }
    current = parent;
  }

  const steps = reversedSteps.reverse();
  return { steps, cost: steps.length };
}

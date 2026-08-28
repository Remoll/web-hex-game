import type { GameMap } from "@/game/board/gameMap/GameMap";
import {
  getHexCoordKey,
  isSameHexCoord,
} from "@/game/board/hexCoord/HexCoord";
import type { HexCoord } from "@/game/types";

/** An intervening field this far above the observer blocks sight beyond it. */
export const steepElevationVisionBlockerDifference = 2;

const sightLineDistanceDecrement = 1;

/**
 * Evaluates height-aware tactical sight without consulting presentation state.
 * A target is visible when at least one shortest hex line is unblocked. This
 * prevents a blocker on one of two equally direct neighbouring lines from
 * extending its shadow across the other line. The target field is deliberately
 * excluded from blocker checks: it is visible itself, while an elevated
 * intervening field hides cells beyond it.
 */
export function hasElevationLineOfSight(
  gameMap: GameMap,
  observer: HexCoord,
  target: HexCoord,
): boolean {
  const observerField = gameMap.getField(observer.q, observer.r);
  const targetField = gameMap.getField(target.q, target.r);
  if (!observerField || !targetField) {
    return false;
  }

  return hasUnblockedShortestSightLine(
    gameMap,
    observer,
    target,
    observerField.getGroundLevel(),
    new Map<string, boolean>(),
  );
}

/**
 * Traverses only neighbours that strictly reduce axial distance to the target.
 * The memoized directed acyclic graph checks each eligible field once, avoiding
 * the exponential path enumeration that ambiguous hex lines would otherwise
 * require.
 */
function hasUnblockedShortestSightLine(
  gameMap: GameMap,
  current: HexCoord,
  target: HexCoord,
  observerGroundLevel: number,
  visibilityByCoordKey: Map<string, boolean>,
): boolean {
  if (isSameHexCoord(current, target)) {
    return true;
  }

  const currentDistance = gameMap.getHexDistance(current, target);
  const currentKey = getHexCoordKey(current);
  const cachedVisibility = visibilityByCoordKey.get(currentKey);
  if (cachedVisibility !== undefined) {
    return cachedVisibility;
  }

  const nextDistance = currentDistance - sightLineDistanceDecrement;
  for (const next of gameMap.getNeighbours(current)) {
    if (gameMap.getHexDistance(next, target) !== nextDistance) {
      continue;
    }

    if (isSameHexCoord(next, target)) {
      visibilityByCoordKey.set(currentKey, true);
      return true;
    }

    const nextField = gameMap.getField(next.q, next.r);
    if (!nextField || isSteepVisionBlocker(nextField.getGroundLevel(), observerGroundLevel)) {
      continue;
    }

    if (hasUnblockedShortestSightLine(
      gameMap,
      next,
      target,
      observerGroundLevel,
      visibilityByCoordKey,
    )) {
      visibilityByCoordKey.set(currentKey, true);
      return true;
    }
  }

  visibilityByCoordKey.set(currentKey, false);
  return false;
}

function isSteepVisionBlocker(
  groundLevel: number,
  observerGroundLevel: number,
): boolean {
  return groundLevel - observerGroundLevel >= steepElevationVisionBlockerDifference;
}

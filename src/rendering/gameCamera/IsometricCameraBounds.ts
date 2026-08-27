import type { GameMap } from "@/game/board/gameMap/GameMap";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import type { RenderConfig } from "@/rendering/RenderConfig";

const cameraNearPlane = 0.1;
const terrainDepthBelowSurface = 0;
const cameraClipSafetyMargin = 1;
const cameraFarPlaneMultiplier = 4;

export interface IsometricCameraBounds {
  readonly targetXLimit: number;
  readonly targetYLimit: number;
  readonly offsetY: number;
  readonly offsetZ: number;
  readonly nearPlane: number;
  readonly farPlane: number;
}

/**
 * Builds conservative isometric camera limits from the actual map geometry.
 * The offset keeps every field in front of the near plane even while the free
 * camera pans to a map boundary.
 */
export function buildIsometricCameraBounds(
  gameMap: GameMap,
  config: RenderConfig,
): IsometricCameraBounds {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxSceneZ = terrainDepthBelowSurface;

  gameMap.forEachField((q, r, field) => {
    const position = HexLayout.hexCoordToPlaneCoord({ q, r }, config.hexSize);
    minX = Math.min(minX, position.x - config.hexSize);
    maxX = Math.max(maxX, position.x + config.hexSize);
    minY = Math.min(minY, position.y - config.hexSize);
    maxY = Math.max(maxY, position.y + config.hexSize);
    maxSceneZ = Math.max(
      maxSceneZ,
      (field.getGroundLevel() + config.terrainBaseLevel) * config.hexDepth
        + config.unitsHeight
        + config.healthBarOffset
        + config.healthBarHeight,
    );
  });

  if (!Number.isFinite(minX)
    || !Number.isFinite(maxX)
    || !Number.isFinite(minY)
    || !Number.isFinite(maxY)) {
    throw new Error("Cannot build camera bounds for an empty map");
  }

  const targetXLimit = Math.max(Math.abs(minX), Math.abs(maxX));
  const targetYLimit = Math.max(Math.abs(minY), Math.abs(maxY));
  const verticalCoverage = maxY - minY;
  const isometricDistance = Math.max(
    verticalCoverage + cameraClipSafetyMargin,
    maxSceneZ + cameraClipSafetyMargin,
  );

  return {
    targetXLimit,
    targetYLimit,
    offsetY: -isometricDistance,
    offsetZ: isometricDistance,
    nearPlane: cameraNearPlane,
    farPlane: isometricDistance * cameraFarPlaneMultiplier,
  };
}

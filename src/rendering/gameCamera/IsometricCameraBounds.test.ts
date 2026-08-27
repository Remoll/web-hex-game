import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { MovementType, TerrainType, type MapArray } from "@/game/types";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import { buildIsometricCameraBounds } from "@/rendering/gameCamera/IsometricCameraBounds";
import { defaultRenderConfig } from "@/rendering/RenderConfig";

const radiusSixMap = createHexDisk(6);

describe("buildIsometricCameraBounds", () => {
  it("keeps the lower radius-6 extent in front of the near plane", () => {
    const gameMap = new GameMap(radiusSixMap);
    const bounds = buildIsometricCameraBounds(gameMap, defaultRenderConfig);
    const lowerMapPoint = toWorldPoint({ q: 0, r: -6 });

    expect(distanceAlongView(
      lowerMapPoint,
      new THREE.Vector3(0, bounds.offsetY, bounds.offsetZ),
      new THREE.Vector3(0, 0, 0),
    )).toBeGreaterThan(bounds.nearPlane);
  });

  it("preserves near-plane coverage while the free camera pans to a boundary", () => {
    const gameMap = new GameMap(radiusSixMap);
    const bounds = buildIsometricCameraBounds(gameMap, defaultRenderConfig);
    const lowerMapPoint = toWorldPoint({ q: 0, r: -6 });
    const boundaryTarget = new THREE.Vector3(0, bounds.targetYLimit, 0);
    const boundaryCameraPosition = new THREE.Vector3(
      0,
      bounds.targetYLimit + bounds.offsetY,
      bounds.offsetZ,
    );

    expect(distanceAlongView(
      lowerMapPoint,
      boundaryCameraPosition,
      boundaryTarget,
    )).toBeGreaterThan(bounds.nearPlane);
  });

  it("accounts for elevated terrain and provides a conservative far plane", () => {
    const elevatedMap: MapArray = radiusSixMap.map((cell) => ({
      ...cell,
      fieldAttrs: {
        ...cell.fieldAttrs,
        groundLevel: cell.q === 0 && cell.r === 0 ? 4 : cell.fieldAttrs.groundLevel,
      },
    }));
    const gameMap = new GameMap(elevatedMap);
    const bounds = buildIsometricCameraBounds(gameMap, defaultRenderConfig);
    const elevatedPoint = toWorldPoint(
      { q: 0, r: 0 },
      (4 + defaultRenderConfig.terrainBaseLevel) * defaultRenderConfig.hexDepth
        + defaultRenderConfig.unitsHeight
        + defaultRenderConfig.healthBarOffset
        + defaultRenderConfig.healthBarHeight,
    );
    const cameraPosition = new THREE.Vector3(0, bounds.offsetY, bounds.offsetZ);
    const target = new THREE.Vector3(0, 0, 0);
    const projectedDistance = distanceAlongView(elevatedPoint, cameraPosition, target);

    expect(projectedDistance).toBeGreaterThan(bounds.nearPlane);
    expect(projectedDistance).toBeLessThan(bounds.farPlane);
  });
});

function createHexDisk(radius: number): MapArray {
  const cells: MapArray = [];

  for (let q = -radius; q <= radius; q += 1) {
    const minR = Math.max(-radius, -q - radius);
    const maxR = Math.min(radius, -q + radius);
    for (let r = minR; r <= maxR; r += 1) {
      cells.push({
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
      });
    }
  }

  return cells;
}

function toWorldPoint(coord: { q: number; r: number }, z: number = 0): THREE.Vector3 {
  const position = HexLayout.hexCoordToPlaneCoord(
    coord,
    defaultRenderConfig.hexSize,
  );
  return new THREE.Vector3(position.x, position.y, z);
}

function distanceAlongView(
  point: THREE.Vector3,
  cameraPosition: THREE.Vector3,
  target: THREE.Vector3,
): number {
  const viewDirection = target.clone().sub(cameraPosition).normalize();
  return point.clone().sub(cameraPosition).dot(viewDirection);
}

import type { HexCoord } from "@/game/types";

export interface CanvasRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface InstanceIntersection {
  readonly instanceId?: number;
}

export function normalizePointer(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
): { x: number; y: number } | undefined {
  if (rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

export function resolveHexFromIntersections(
  intersections: readonly InstanceIntersection[],
  getHexAtInstance: (instanceId: number) => HexCoord | undefined,
): HexCoord | undefined {
  const instanceId = intersections[0]?.instanceId;
  return instanceId === undefined ? undefined : getHexAtInstance(instanceId);
}

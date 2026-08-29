import { FieldVisibility } from "@/game/visibility/MageVisibility";

export const opaqueFogOpacity = 1;
export const fogSurfaceDepthTestEnabled = true;
export const noFogPolygonOffset = 0;
/** Pulls opaque Undiscovered fog walls ahead of coplanar terrain side walls. */
export const undiscoveredFogWallPolygonOffsetFactor = -1;
export const undiscoveredFogWallPolygonOffsetUnits = -1;

export interface FogDepthBiasPolicy {
  readonly polygonOffset: boolean;
  readonly polygonOffsetFactor: number;
  readonly polygonOffsetUnits: number;
}

export interface FogSurfaceMaterialPolicy {
  readonly opacity: number;
  /** Fog keeps depth testing enabled so it cannot paint through visible terrain. */
  readonly depthTest: boolean;
  readonly depthBias: FogDepthBiasPolicy;
}

export const noFogDepthBias: FogDepthBiasPolicy = {
  polygonOffset: false,
  polygonOffsetFactor: noFogPolygonOffset,
  polygonOffsetUnits: noFogPolygonOffset,
};

export const undiscoveredFogWallDepthBias: FogDepthBiasPolicy = {
  polygonOffset: true,
  polygonOffsetFactor: undiscoveredFogWallPolygonOffsetFactor,
  polygonOffsetUnits: undiscoveredFogWallPolygonOffsetUnits,
};

export interface FogMaterialPolicy {
  /** Policy for the terrain-cap group of a fog prism. */
  readonly cap: FogSurfaceMaterialPolicy;
  /** Policy for the vertical side-wall group of a fog prism. */
  readonly sideWall: FogSurfaceMaterialPolicy;
}

/**
 * Keeps fog opacity consistent across the cap and vertical sides of each
 * visibility state. Visible fields do not receive a fog layer.
 */
export function getFogMaterialPolicy(
  visibility: FieldVisibility,
  discoveredFogOpacity: number,
): FogMaterialPolicy | undefined {
  switch (visibility) {
    case FieldVisibility.Undiscovered:
      return {
        cap: createFogSurfaceMaterialPolicy(opaqueFogOpacity),
        sideWall: createFogSurfaceMaterialPolicy(
          opaqueFogOpacity,
          undiscoveredFogWallDepthBias,
        ),
      };
    case FieldVisibility.Discovered:
      return {
        cap: createFogSurfaceMaterialPolicy(discoveredFogOpacity),
        sideWall: createFogSurfaceMaterialPolicy(discoveredFogOpacity),
      };
    case FieldVisibility.Visible:
      return undefined;
  }
}

function createFogSurfaceMaterialPolicy(
  opacity: number,
  depthBias: FogDepthBiasPolicy = noFogDepthBias,
): FogSurfaceMaterialPolicy {
  return {
    opacity,
    depthTest: fogSurfaceDepthTestEnabled,
    depthBias,
  };
}

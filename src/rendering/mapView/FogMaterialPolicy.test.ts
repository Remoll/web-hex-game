import { describe, expect, it } from "vitest";
import { FieldVisibility } from "@/game/visibility/MageVisibility";
import {
  fogSurfaceDepthTestEnabled,
  getFogMaterialPolicy,
  noFogDepthBias,
  opaqueFogOpacity,
  undiscoveredFogWallDepthBias,
} from "@/rendering/mapView/FogMaterialPolicy";
import { defaultRenderConfig } from "@/rendering/RenderConfig";

describe("getFogMaterialPolicy", () => {
  it("makes Undiscovered caps and side walls fully opaque with a wall-only depth bias", () => {
    expect(getFogMaterialPolicy(
      FieldVisibility.Undiscovered,
      defaultRenderConfig.discoveredFogOpacity,
    )).toEqual({
      cap: {
        opacity: opaqueFogOpacity,
        depthTest: fogSurfaceDepthTestEnabled,
        depthBias: noFogDepthBias,
      },
      sideWall: {
        opacity: opaqueFogOpacity,
        depthTest: fogSurfaceDepthTestEnabled,
        depthBias: undiscoveredFogWallDepthBias,
      },
    });
  });

  it("keeps Discovered caps and side walls equally translucent without a depth bias", () => {
    expect(getFogMaterialPolicy(
      FieldVisibility.Discovered,
      defaultRenderConfig.discoveredFogOpacity,
    )).toEqual({
      cap: {
        opacity: defaultRenderConfig.discoveredFogOpacity,
        depthTest: fogSurfaceDepthTestEnabled,
        depthBias: noFogDepthBias,
      },
      sideWall: {
        opacity: defaultRenderConfig.discoveredFogOpacity,
        depthTest: fogSurfaceDepthTestEnabled,
        depthBias: noFogDepthBias,
      },
    });
  });

  it("does not create a fog policy for visible terrain", () => {
    expect(getFogMaterialPolicy(
      FieldVisibility.Visible,
      defaultRenderConfig.discoveredFogOpacity,
    )).toBeUndefined();
  });
});

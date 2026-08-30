import { describe, expect, it } from "vitest";
import { TacticalHighlightKind } from "@/rendering/mapHighlightView/MapHighlightRenderModel";
import { getMapHighlightMaterialPolicy } from "@/rendering/mapHighlightView/MapHighlightMaterialPolicy";

describe("getMapHighlightMaterialPolicy", () => {
  it("renders public campaign routes above fog without changing tactical depth behaviour", () => {
    const campaignRoutePolicy = getMapHighlightMaterialPolicy(
      TacticalHighlightKind.CampaignRoute,
    );
    const movePolicy = getMapHighlightMaterialPolicy(TacticalHighlightKind.Move);

    expect(campaignRoutePolicy).toMatchObject({
      depthTest: false,
    });
    expect(campaignRoutePolicy.opacity).toBeGreaterThan(movePolicy.opacity);
    expect(campaignRoutePolicy.renderOrder).toBeGreaterThan(movePolicy.renderOrder);
    expect(movePolicy.depthTest).toBe(true);
  });
});

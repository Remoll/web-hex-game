import { describe, expect, it, vi } from "vitest";
import { CampaignRouteFeedbackPresenter } from "@/app/campaignRouteFeedback/CampaignRouteFeedbackPresenter";
import { TacticalHighlightKind } from "@/rendering/mapHighlightView/MapHighlightRenderModel";

describe("CampaignRouteFeedbackPresenter", () => {
  it("retains public route feedback across interaction refreshes", () => {
    const sync = vi.fn();
    const presenter = new CampaignRouteFeedbackPresenter({ sync });

    presenter.syncRouteEndpoints([{ q: 4, r: 0 }]);
    presenter.sync([{ kind: TacticalHighlightKind.Move, coord: { q: 1, r: 0 } }]);
    presenter.sync([]);

    expect(sync).toHaveBeenLastCalledWith([
      {
        kind: TacticalHighlightKind.CampaignRoute,
        coord: { q: 4, r: 0 },
      },
    ]);
  });
});

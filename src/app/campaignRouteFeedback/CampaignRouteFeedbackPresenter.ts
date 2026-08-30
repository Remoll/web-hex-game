import {
  TacticalHighlightKind,
  type TacticalHighlight,
} from "@/rendering/mapHighlightView/MapHighlightRenderModel";
import type { HexCoord } from "@/game/types";

export interface MapHighlightPresenter {
  sync(highlights: readonly TacticalHighlight[]): void;
}

/**
 * Composes public campaign-route feedback with temporary tactical or strategic
 * interaction feedback so routine preview refreshes cannot remove entrances.
 */
export class CampaignRouteFeedbackPresenter implements MapHighlightPresenter {
  private routeHighlights: readonly TacticalHighlight[] = [];
  private interactionHighlights: readonly TacticalHighlight[] = [];

  constructor(private readonly mapHighlightPresenter: MapHighlightPresenter) {}

  syncRouteEndpoints(routeEndpoints: readonly HexCoord[]): void {
    this.routeHighlights = routeEndpoints.map((coord) => ({
      kind: TacticalHighlightKind.CampaignRoute,
      coord: { ...coord },
    }));
    this.publish();
  }

  sync(highlights: readonly TacticalHighlight[]): void {
    this.interactionHighlights = highlights;
    this.publish();
  }

  private publish(): void {
    this.mapHighlightPresenter.sync([
      ...this.routeHighlights,
      ...this.interactionHighlights,
    ]);
  }
}

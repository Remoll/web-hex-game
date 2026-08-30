import type { MapInteractionController } from "@/app/inputController/MapInteractionController";
import {
  GameActionPreviewType,
  GameActionRejectionReason,
  type GameActionPreview,
} from "@/game/gameSession/GameSession";
import { type HexCoord } from "@/game/types";
import {
  TacticalHighlightKind,
  type TacticalHighlight,
} from "@/rendering/mapHighlightView/MapHighlightRenderModel";
import type { MapHighlightPresenter } from "@/app/campaignRouteFeedback/CampaignRouteFeedbackPresenter";
import { StrategicSession } from "@/game/strategicSession/StrategicSession";

const strategicNavigationPathCost = 0;
const strategicMageMarkerId = "player";

export interface StrategicControllerOptions {
  readonly onPartyMoved: () => void;
}

/** App adapter for navigation-only strategic movement; it never creates tactical state. */
export class StrategicController implements MapInteractionController {
  constructor(
    private readonly session: StrategicSession,
    private readonly highlights: MapHighlightPresenter,
    private readonly options: StrategicControllerOptions,
  ) {
    this.syncHighlights();
  }

  clickHex(coord: HexCoord): void {
    if (this.session.moveTo(coord)) {
      this.options.onPartyMoved();
    }
    this.syncHighlights();
  }

  previewHex(coord: HexCoord): GameActionPreview {
    const partyPosition = this.session.partyPosition;
    const preview: GameActionPreview = coord.q === partyPosition.q && coord.r === partyPosition.r
      ? { type: GameActionPreviewType.Selection, unitId: strategicMageMarkerId }
      : this.session.canMoveTo(coord)
        ? {
          type: GameActionPreviewType.ValidMove,
          unitId: strategicMageMarkerId,
          destination: { ...coord },
          path: { steps: [{ ...coord }], cost: strategicNavigationPathCost },
        }
        : {
          type: GameActionPreviewType.OutOfRange,
          reason: GameActionRejectionReason.OutOfRange,
        };
    this.syncHighlights();
    return preview;
  }

  clearPreview(): void {
    this.syncHighlights();
  }

  private syncHighlights(): void {
    const highlights: TacticalHighlight[] = [{
      kind: TacticalHighlightKind.Selected,
      coord: this.session.partyPosition,
    }];
    for (const coordinate of this.session.getReachableCoordinates()) {
      highlights.push({ kind: TacticalHighlightKind.Move, coord: coordinate });
    }
    this.highlights.sync(highlights);
  }
}

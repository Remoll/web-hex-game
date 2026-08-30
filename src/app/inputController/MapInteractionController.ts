import type { GameActionPreview } from "@/game/gameSession/GameSession";
import type { HexCoord } from "@/game/types";

/** Shared pointer contract for tactical and navigation-only strategic maps. */
export interface MapInteractionController {
  clickHex(coord: HexCoord): void;
  previewHex(coord: HexCoord): GameActionPreview;
  clearPreview(): void;
}

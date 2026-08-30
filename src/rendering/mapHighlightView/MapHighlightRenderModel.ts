import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { HexCoord } from "@/game/types";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import type { RenderConfig } from "@/rendering/RenderConfig";

/** Semantic overlays shared by input feedback and the renderer. */
export enum TacticalHighlightKind {
  CampaignRoute = "campaign-route",
  Selected = "selected",
  Command = "command",
  Move = "move",
  Attack = "attack",
  Initiative = "initiative",
}

export const tacticalHighlightKinds: readonly TacticalHighlightKind[] = [
  TacticalHighlightKind.CampaignRoute,
  TacticalHighlightKind.Selected,
  TacticalHighlightKind.Command,
  TacticalHighlightKind.Move,
  TacticalHighlightKind.Attack,
  TacticalHighlightKind.Initiative,
];

/** Renderer-neutral semantic feedback supplied by the application layer. */
export interface TacticalHighlight {
  readonly coord: HexCoord;
  readonly kind: TacticalHighlightKind;
}

export interface MapHighlightRenderState extends TacticalHighlight {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Converts semantic highlight coordinates into renderer coordinates.
 * Invalid or duplicated highlights are ignored so callers can safely refresh
 * previews without doing renderer-specific bookkeeping.
 */
export function buildMapHighlightRenderStates(
  highlights: readonly TacticalHighlight[],
  gameMap: GameMap,
  config: RenderConfig,
): readonly MapHighlightRenderState[] {
  const states: MapHighlightRenderState[] = [];
  const seen = new Set<string>();

  for (const highlight of highlights) {
    const key = `${highlight.kind}:${highlight.coord.q}:${highlight.coord.r}`;
    if (seen.has(key)) {
      continue;
    }

    const field = gameMap.getField(highlight.coord.q, highlight.coord.r);
    if (!field) {
      continue;
    }

    seen.add(key);
    const planePosition = HexLayout.hexCoordToPlaneCoord(
      highlight.coord,
      config.hexSize,
    );

    states.push({
      ...highlight,
      x: planePosition.x,
      y: planePosition.y,
      z:
        (field.getGroundLevel() + config.terrainBaseLevel) * config.hexDepth
        + config.tacticalHighlightZOffset,
    });
  }

  return states;
}

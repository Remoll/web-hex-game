import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { UnitMovementEvent } from "@/game/gameSession/GameSession";
import type { Unit } from "@/game/unit/Unit";
import type { RenderConfig } from "@/rendering/RenderConfig";
import { buildUnitRenderStateAt } from "@/rendering/unitView/UnitRenderModel";
import type { UnitMovementAnimation } from "@/rendering/unitMotion/UnitMovementAnimationQueue";

/**
 * Converts a domain event to visual keyframes only when the final unit is
 * currently safe to render. The event itself never changes game state.
 */
export function buildVisibleUnitMovementAnimation(
  event: UnitMovementEvent,
  unit: Unit | undefined,
  isVisible: boolean,
  gameMap: GameMap,
  config: RenderConfig,
): UnitMovementAnimation | undefined {
  if (!unit?.isAlive || !isVisible) {
    return undefined;
  }

  return {
    unitId: event.unitId,
    states: [event.from, ...event.steps].map((coord) =>
      buildUnitRenderStateAt(coord, gameMap, config),
    ),
  };
}

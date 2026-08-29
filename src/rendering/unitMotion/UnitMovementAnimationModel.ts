import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { UnitMovementEvent } from "@/game/gameSession/GameSession";
import type { RenderConfig } from "@/rendering/RenderConfig";
import { buildUnitRenderStateAt } from "@/rendering/unitView/UnitRenderModel";
import type { UnitMovementAnimation } from "@/rendering/unitMotion/UnitMovementAnimationQueue";

/**
 * Converts a fog-safe domain event to visual keyframes. The event itself never
 * changes game state or reads a later authoritative unit state.
 */
export function buildVisibleUnitMovementAnimation(
  event: UnitMovementEvent,
  gameMap: GameMap,
  config: RenderConfig,
): UnitMovementAnimation | undefined {
  if (!event.unit.isAlive) {
    return undefined;
  }

  return {
    unitId: event.unit.id,
    states: [event.from, ...event.steps].map((coord) =>
      buildUnitRenderStateAt(coord, gameMap, config),
    ),
  };
}

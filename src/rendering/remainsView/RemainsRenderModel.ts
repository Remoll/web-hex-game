import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { Unit } from "@/game/unit/Unit";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import type { RenderConfig } from "@/rendering/RenderConfig";

export interface RemainsRenderState {
  readonly unitId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Dead units retain a visual coordinate without participating in game rules. */
export function buildRemainsRenderState(
  unit: Unit,
  gameMap: GameMap,
  config: RenderConfig,
): RemainsRenderState | undefined {
  if (unit.isAlive) {
    return undefined;
  }

  const position = unit.position;
  const planePosition = HexLayout.hexCoordToPlaneCoord(position, config.hexSize);
  const field = gameMap.getField(position.q, position.r);
  const level = field?.getGroundLevel() ?? 0;

  return {
    unitId: unit.id,
    x: planePosition.x,
    y: planePosition.y,
    z:
      (level + config.terrainBaseLevel) * config.hexDepth
      + config.remainsZOffset,
  };
}
